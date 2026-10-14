import { execFile, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js')
const git = promisify(execFile)

async function assertCleanCheckout(commit) {
  const head = (await git('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  const changed = (await git('git', ['status', '--porcelain'], { cwd: root })).stdout.trim()
  if (head !== commit || changed) throw new Error('请提交所有修改，并使用当前 HEAD 发布')
}

export async function releasePlan({ branch, commit }) {
  if (!['main', 'pre'].includes(branch)) throw new Error('仅允许发布固定 pre 或 main 分支')
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('发布必须使用完整的 Git 提交编号')
  const filename = path.join(root, 'wrangler.jsonc')
  const parsed = ts.parseConfigFileTextToJson(filename, await readFile(filename, 'utf8'))
  if (parsed.error) throw new Error('应用配置不是有效的 JSONC')
  const config = parsed.config
  if (
    config.assets?.binding !== 'ASSETS' ||
    !config.previews ||
    config.pages_build_output_dir ||
    config.env
  )
    throw new Error('发布配置必须使用 Static Assets 和原生 Preview')
  delete config.$schema
  delete config.account_id
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  if (accountId) {
    if (!/^[a-f0-9]{32}$/i.test(accountId))
      throw new Error('CLOUDFLARE_ACCOUNT_ID 必须是 32 位十六进制账号 ID')
    config.account_id = accountId
  }
  config.main = path.resolve(root, config.main)
  config.assets.directory = path.resolve(root, config.assets.directory)
  config.vars = {
    ...config.vars,
    ...(process.env.ALLOWED_ORIGINS !== undefined
      ? { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS }
      : {}),
    EVIEWER_PROXY_REVISION: commit,
    EVIEWER_PROXY_ENVIRONMENT: 'production',
  }
  config.previews.vars = {
    ...config.previews.vars,
    ...(process.env.PREVIEW_ALLOWED_ORIGINS !== undefined
      ? { ALLOWED_ORIGINS: process.env.PREVIEW_ALLOWED_ORIGINS }
      : {}),
    EVIEWER_PROXY_REVISION: commit,
    EVIEWER_PROXY_ENVIRONMENT: 'preview',
  }
  return {
    branch,
    commit,
    environment: branch === 'main' ? 'production' : 'preview',
    workerName: config.name,
    config,
  }
}

function runWrangler(args, cwd, outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_LOG: 'error',
        WRANGLER_WRITE_LOGS: 'false',
        WRANGLER_LOG_SANITIZE: 'true',
        WRANGLER_OUTPUT_FILE_PATH: outputFile,
      },
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Wrangler ${args[0]} 失败（${code}）`)),
    )
  })
}

async function cloudflareRequest(pathname, fetcher, body) {
  const response = await fetcher(new URL(pathname, 'https://api.cloudflare.com/client/v4/'), {
    method: body ? 'PATCH' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/merge-patch+json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json()
  if (!response.ok || data.success !== true)
    throw new Error(
      `Cloudflare Preview API 失败（HTTP ${response.status}，错误码 ${(data.errors || []).map((error) => error.code).join(', ')}）`,
    )
  return data.result
}

async function resolvePreview(plan, event, fetcher) {
  const workerPath = `accounts/${encodeURIComponent(plan.config.account_id)}/workers/workers/${encodeURIComponent(plan.workerName)}`
  const worker = await cloudflareRequest(workerPath, fetcher)
  if (worker.name !== plan.workerName) throw new Error('Cloudflare 返回的 Worker 与目标应用不一致')
  // Existing Workers do not inherit this switch from `wrangler preview`.
  // Merge-patch only Preview URLs, preserving production routes and subdomain.
  if (worker.subdomain?.previews_enabled !== true)
    await cloudflareRequest(workerPath, fetcher, { subdomain: { previews_enabled: true } })
  const previewPath = `${workerPath}/previews/${encodeURIComponent(event.preview_id)}`
  const preview = await cloudflareRequest(previewPath, fetcher)
  const deployment = await cloudflareRequest(
    `${previewPath}/deployments/${encodeURIComponent(event.deployment_id)}`,
    fetcher,
  )
  if (
    preview.id !== event.preview_id ||
    preview.name !== 'pre' ||
    deployment.id !== event.deployment_id
  )
    throw new Error('Cloudflare 返回的 Preview 或部署与发布结果不一致')
  return { ...event, preview_urls: preview.urls, deployment_urls: deployment.urls }
}

async function verifyApp(target, fetcher) {
  for (const pathname of ['/', '/hentaiverse', '/settings']) {
    const response = await fetcher(new URL(pathname, target), {
      headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const html = await response.text()
    if (!response.ok || !html.includes('id="app"'))
      throw new Error(`预览页面 ${pathname} 未返回应用框架`)
  }
  const response = await fetcher(new URL('/hentaiverse/unknown', target), {
    headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
    signal: AbortSignal.timeout(10_000),
  })
  if (
    response.status !== 404 ||
    !response.headers.get('Content-Type')?.includes('application/json')
  )
    throw new Error('预览 API 路由未正确交给代理')
}

async function verifyPreviewAlias(urls, plan, fetcher) {
  if (!urls?.length) throw new Error('Cloudflare 未返回固定 pre 地址')
  for (const url of urls) {
    for (const pathname of ['/health', '/deployment.json']) {
      const response = await fetcher(new URL(pathname, url), {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      const data = await response.json()
      if (
        !response.ok ||
        data.revision !== plan.commit ||
        (pathname === '/health' &&
          (data.environment !== 'preview' ||
            data.hosting !== 'workers-static-assets' ||
            data.assets !== true))
      )
        throw new Error('固定 pre 地址尚未指向目标提交')
    }
  }
}

export async function release(
  options,
  { run = runWrangler, fetcher = fetch, verifyCheckout = assertCleanCheckout, wait = delay } = {},
) {
  const plan = await releasePlan(options)
  await readFile(path.join(plan.config.assets.directory, 'index.html'))
  const build = JSON.parse(
    await readFile(path.join(plan.config.assets.directory, 'deployment.json'), 'utf8'),
  )
  if (build.revision !== plan.commit) throw new Error('前端构建与发布提交不一致，请重新构建')
  if (!options.dryRun) {
    await verifyCheckout(plan.commit)
    if (!plan.config.account_id)
      throw new Error('请在安全环境变量或仓库 Actions Secret 中配置 CLOUDFLARE_ACCOUNT_ID')
    if (!process.env.CLOUDFLARE_API_TOKEN)
      throw new Error('请在安全环境变量或 Actions Secrets 中配置 CLOUDFLARE_API_TOKEN')
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'eviewer-static-assets-'))
  try {
    const configPath = path.join(directory, 'wrangler.json')
    const outputFile = path.join(directory, 'wrangler-output.jsonl')
    // Native Preview has no dry-run. Compile its scoped settings with deploy
    // --dry-run; publishing a Preview always uses the native preview command.
    const config =
      options.dryRun && plan.environment === 'preview'
        ? { ...plan.config, ...plan.config.previews }
        : plan.config
    await writeFile(configPath, JSON.stringify(config, null, 2))
    console.log(
      JSON.stringify({
        worker: plan.workerName,
        branch: plan.branch,
        revision: plan.commit,
        dryRun: Boolean(options.dryRun),
      }),
    )
    const args = options.dryRun
      ? ['deploy', '--dry-run', '--outdir', path.join(directory, 'bundle')]
      : plan.environment === 'preview'
        ? ['preview', '--name', 'pre', '--worker-name', plan.workerName, '--ignore-base-config']
        : ['deploy']
    await run([...args, '--config', configPath], root, outputFile)
    if (options.dryRun) return plan
    const events = (await readFile(outputFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    let event = events.findLast(
      (item) => item.type === (plan.environment === 'preview' ? 'preview' : 'deploy'),
    )
    if (
      !event ||
      (event.worker_name !== undefined && event.worker_name !== plan.workerName) ||
      (plan.environment === 'production' && event.worker_name !== plan.workerName) ||
      (plan.environment === 'preview' &&
        (event.preview_name !== 'pre' || !event.preview_id || !event.deployment_id))
    )
      throw new Error(
        `Wrangler 发布结果未指向目标应用或固定 pre Preview：${JSON.stringify({
          type: event?.type,
          worker_name: event?.worker_name,
          preview_name: event?.preview_name,
        })}`,
      )
    if (plan.environment === 'preview') event = await resolvePreview(plan, event, fetcher)
    const urls =
      plan.environment === 'preview'
        ? event.deployment_urls || []
        : (event.targets || []).filter((target) => /^https:\/\//.test(target))
    const target = urls.find((url) => {
      try {
        return new URL(url).protocol === 'https:'
      } catch {
        return false
      }
    })
    if (!target) throw new Error('发布结果未提供可验证的应用 URL')
    let lastFailure = '前后端版本或资产绑定未就绪'
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetcher(new URL('/health', target), {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        })
        const health = await response.json()
        if (
          response.ok &&
          health.revision === plan.commit &&
          health.environment === plan.environment &&
          health.hosting === 'workers-static-assets' &&
          health.assets === true
        ) {
          const assetResponse = await fetcher(new URL('/deployment.json', target), {
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          })
          if (!assetResponse.ok || (await assetResponse.json()).revision !== plan.commit) {
            if (attempt < 9) await wait(3_000)
            continue
          }
          await verifyApp(target, fetcher)
          if (plan.environment === 'preview')
            await verifyPreviewAlias(event.preview_urls, plan, fetcher)
          console.log(`发布并验证完成：${plan.environment}；revision=${plan.commit}`)
          if (process.env.GITHUB_ACTIONS && plan.environment === 'preview')
            console.log(`::notice::Preview 验证通过；revision=${plan.commit}`)
          return plan
        }
      } catch (error) {
        lastFailure = error.message
        // Allow propagation without repeating the publish.
      }
      if (attempt < 9) await wait(3_000)
    }
    throw new Error(`未能确认静态资源与代理属于目标提交：${lastFailure}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        branch: { type: 'string' },
        commit: { type: 'string' },
        'dry-run': { type: 'boolean' },
      },
    })
    await release({ branch: values.branch, commit: values.commit, dryRun: values['dry-run'] })
  } catch (error) {
    const message = String(error.message)
    console.error(
      process.env.GITHUB_ACTIONS
        ? `::error::${message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`
        : message,
    )
    process.exitCode = 1
  }
}
