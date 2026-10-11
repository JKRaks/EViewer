import { execFile, spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const wrangler = path.join(root, 'deploy/eproxy/node_modules/wrangler/bin/wrangler.js')
const projectName = 'eviewer'
const productionBranch = 'main'
const git = promisify(execFile)

async function assertCleanCheckout(commit) {
  const head = (await git('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  const changed = (await git('git', ['status', '--porcelain'], { cwd: root })).stdout.trim()
  if (head !== commit || changed) throw new Error('请提交所有修改，并使用当前 HEAD 发布')
}

async function workerConfig() {
  const filename = path.join(root, 'deploy/eproxy/wrangler.jsonc')
  const parsed = ts.parseConfigFileTextToJson(filename, await readFile(filename, 'utf8'))
  if (parsed.error) throw new Error('Worker 配置不是有效的 JSONC')
  return parsed.config
}

function prNumber(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value))) throw new Error('PR 编号不正确')
  return String(value)
}

export async function releasePlan({ branch, commit, pr }) {
  if (!branch || /[\0\r\n]/.test(branch)) throw new Error('缺少有效的发布分支')
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('发布必须使用完整的 Git 提交编号')
  const base = await workerConfig()
  const environment = branch === productionBranch ? 'production' : 'preview'
  const workerName =
    environment === 'production'
      ? base.name
      : `${base.name}-${pr ? `pr-${prNumber(pr)}` : 'preview'}-${commit.slice(0, 16)}`
  const worker = {
    ...base,
    main: path.join(root, 'proxy-server.workers.js'),
    name: workerName,
    vars: {
      ...base.vars,
      EVIEWER_PROXY_REVISION: commit,
      EVIEWER_PROXY_ENVIRONMENT: environment,
    },
  }
  delete worker.$schema
  if (environment === 'preview') {
    worker.routes = []
    worker.workers_dev = false
    worker.preview_urls = false
    worker.keep_vars = false
    worker.vars.ALLOWED_AUTH_EXPORT_ORIGINS = ''
    worker.ratelimits = base.ratelimits.map((binding) => ({ ...binding, namespace_id: '1' }))
  }
  const deployment = {
    services: [{ binding: 'EPROXY', service: workerName }],
    vars: {
      EVIEWER_PROXY_REVISION: commit,
      EVIEWER_PROXY_ENVIRONMENT: environment,
    },
  }
  const pages = {
    name: projectName,
    pages_build_output_dir: path.join(root, 'dist'),
    compatibility_date: base.compatibility_date,
    ...deployment,
    env: { [environment]: deployment },
  }
  return { branch, commit, environment, workerName, accountId: base.account_id, worker, pages }
}

function runWrangler(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Wrangler ${args[0]} 失败（${code}）`))
    })
  })
}

function cloudflareApi(accountId, fetcher) {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('请在 CI Secrets 中配置 CLOUDFLARE_API_TOKEN')
  return async (endpoint, method = 'GET') => {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}${endpoint}`,
      {
        method,
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      },
    )
    const payload = await response.json()
    if (!response.ok || !payload.success) {
      throw new Error(
        `Cloudflare API ${response.status}: ${payload.errors?.map((error) => error.message).join('; ') || '请求失败'}`,
      )
    }
    return payload.result
  }
}

export async function release(
  options,
  { run = runWrangler, fetcher = fetch, verifyCheckout = assertCleanCheckout, wait = delay } = {},
) {
  const plan = await releasePlan(options)
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== plan.accountId) {
    throw new Error('发布账号与仓库中的 Cloudflare 账号不一致')
  }
  if (!options.dryRun) await verifyCheckout(plan.commit)
  // Build the frontend before changing either live service.
  await readFile(path.join(root, 'dist/index.html'))
  const api = options.dryRun ? undefined : cloudflareApi(plan.accountId, fetcher)
  if (api) {
    const project = await api(`/pages/projects/${projectName}`)
    if (project.production_branch !== productionBranch) {
      throw new Error('Pages 生产分支必须为 main，已停止发布')
    }
  }
  console.log(
    JSON.stringify({
      environment: plan.environment,
      branch: plan.branch,
      revision: plan.commit,
      worker: plan.workerName,
      binding: 'EPROXY',
      dryRun: Boolean(options.dryRun),
    }),
  )
  const directory = await mkdtemp(path.join(tmpdir(), 'eviewer-release-'))
  try {
    await writeFile(path.join(directory, 'worker.json'), JSON.stringify(plan.worker, null, 2))
    await writeFile(path.join(directory, 'wrangler.json'), JSON.stringify(plan.pages, null, 2))
    await cp(path.join(root, 'functions'), path.join(directory, 'functions'), { recursive: true })
    await run(
      [
        'pages',
        'functions',
        'build',
        'functions',
        '--outfile',
        path.join(directory, 'pages.bundle'),
        '--project-directory',
        directory,
        '--build-metadata-path',
        path.join(directory, 'pages-metadata.json'),
      ],
      directory,
    )
    const bundle = await readFile(path.join(directory, 'pages.bundle'))
    const boundary = bundle.subarray(2, bundle.indexOf('\r\n')).toString()
    const multipart = await new Response(bundle, {
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    }).formData()
    const metadataFile = multipart.get('metadata')
    const metadata = JSON.parse(
      typeof metadataFile === 'string' ? metadataFile : await metadataFile.text(),
    )
    if (
      !metadata.bindings?.some(
        (binding) => binding.name === 'EPROXY' && binding.service === plan.workerName,
      ) ||
      !metadata.bindings?.some(
        (binding) => binding.name === 'EVIEWER_PROXY_REVISION' && binding.text === plan.commit,
      ) ||
      !metadata.bindings?.some(
        (binding) =>
          binding.name === 'EVIEWER_PROXY_ENVIRONMENT' && binding.text === plan.environment,
      )
    ) {
      throw new Error('Pages 编译产物未包含对应的 Worker 与发布版本')
    }
    await run(
      [
        'deploy',
        '--config',
        path.join(directory, 'worker.json'),
        ...(options.dryRun ? ['--dry-run', '--outdir', path.join(directory, 'worker-output')] : []),
      ],
      directory,
    )
    if (options.dryRun) return plan
    await run(
      [
        'pages',
        'deploy',
        '--project-name',
        projectName,
        '--branch',
        plan.branch,
        '--commit-hash',
        plan.commit,
        '--commit-dirty=false',
      ],
      directory,
    )
    for (let attempt = 0; attempt < 10; attempt++) {
      const deployments = await api(
        `/pages/projects/${projectName}/deployments?env=${plan.environment}&per_page=25`,
      )
      const deployment = deployments.find(
        (item) =>
          item.deployment_trigger?.metadata?.commit_hash === plan.commit &&
          item.deployment_trigger?.metadata?.branch === plan.branch,
      )
      if (deployment?.url) {
        try {
          const health = await fetcher(new URL('/health', deployment.url), {
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
          })
          const status = await health.json()
          if (
            health.ok &&
            status.revision === plan.commit &&
            status.environment === plan.environment
          ) {
            console.log(`发布并验证完成：${deployment.url}`)
            return plan
          }
        } catch {
          // A new Pages deployment may take a few seconds to propagate.
        }
      }
      if (attempt < 9) await wait(3_000)
    }
    throw new Error('未能确认 Pages 与 Worker 版本一致，请检查部署状态及 EPROXY 绑定')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function cleanupPreview(pr, branch, { fetcher = fetch } = {}) {
  if (!branch || branch === productionBranch) throw new Error('清理预览必须提供非生产分支')
  const base = await workerConfig()
  const prefix = `${base.name}-pr-${prNumber(pr)}-`
  const api = cloudflareApi(base.account_id, fetcher)
  const workers = (await api('/workers/scripts')).filter(
    (worker) =>
      worker.id.startsWith(prefix) && /^[a-f0-9]{16}$/.test(worker.id.slice(prefix.length)),
  )
  const commits = new Set(workers.map((worker) => worker.id.slice(prefix.length)))
  const matches = []
  for (let page = 1; ; page++) {
    const deployments = await api(
      `/pages/projects/${projectName}/deployments?env=preview&per_page=25&page=${page}`,
    )
    for (const deployment of deployments) {
      const commit = deployment.deployment_trigger?.metadata?.commit_hash || ''
      if (
        commits.has(commit.slice(0, 16)) &&
        deployment.deployment_trigger?.metadata?.branch === branch
      )
        matches.push(deployment)
    }
    if (deployments.length < 25) break
  }
  // Collect before deleting so pagination does not skip deployments as the list shrinks.
  // Delete Pages first; do not leave live pages bound to deleted Workers.
  for (const deployment of matches)
    await api(`/pages/projects/${projectName}/deployments/${deployment.id}?force=true`, 'DELETE')
  for (const worker of workers) await api(`/workers/scripts/${worker.id}`, 'DELETE')
  console.log(`已清理 PR #${pr} 的 ${workers.length} 个预发 Worker`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        branch: { type: 'string' },
        commit: { type: 'string' },
        pr: { type: 'string' },
        'dry-run': { type: 'boolean' },
        'cleanup-pr': { type: 'string' },
      },
    })
    if (values['cleanup-pr']) await cleanupPreview(values['cleanup-pr'], values.branch)
    else
      await release({
        branch: values.branch,
        commit: values.commit,
        pr: values.pr,
        dryRun: values['dry-run'],
      })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
