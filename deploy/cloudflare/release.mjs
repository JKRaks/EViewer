import { execFile, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const wrangler = path.join(root, 'deploy/eproxy/node_modules/wrangler/bin/wrangler.js')
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
  config.main = path.resolve(root, config.main)
  config.assets.directory = path.resolve(root, config.assets.directory)
  config.vars = {
    ...config.vars,
    EVIEWER_PROXY_REVISION: commit,
    EVIEWER_PROXY_ENVIRONMENT: 'production',
  }
  config.previews.vars = {
    ...config.previews.vars,
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
        WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || path.join(cwd, '.wrangler/logs'),
        WRANGLER_OUTPUT_FILE_PATH: outputFile,
      },
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Wrangler ${args[0]} 失败（${code}）`)),
    )
  })
}

export async function release(
  options,
  { run = runWrangler, fetcher = fetch, verifyCheckout = assertCleanCheckout, wait = delay } = {},
) {
  const plan = await releasePlan(options)
  if (
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_ACCOUNT_ID !== plan.config.account_id
  )
    throw new Error('发布账号与仓库中的 Cloudflare 账号不一致')
  await readFile(path.join(plan.config.assets.directory, 'index.html'))
  const build = JSON.parse(
    await readFile(path.join(plan.config.assets.directory, 'deployment.json'), 'utf8'),
  )
  if (build.revision !== plan.commit) throw new Error('前端构建与发布提交不一致，请重新构建')
  if (!options.dryRun) {
    await verifyCheckout(plan.commit)
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
    const event = events.findLast(
      (item) => item.type === (plan.environment === 'preview' ? 'preview' : 'deploy'),
    )
    if (
      event?.worker_name !== plan.workerName ||
      (plan.environment === 'preview' && event.preview_name !== 'pre')
    )
      throw new Error('Wrangler 发布结果未指向目标应用或固定 pre Preview')
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
          console.log(`发布并验证完成：${target}`)
          if (plan.environment === 'preview')
            console.log(`固定 pre 地址：${(event.preview_urls || []).join(', ')}`)
          return plan
        }
      } catch {
        // Allow propagation without repeating the publish.
      }
      if (attempt < 9) await wait(3_000)
    }
    throw new Error('未能确认静态资源与代理属于目标提交，请检查部署状态')
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
