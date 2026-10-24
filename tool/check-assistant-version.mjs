import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { ASSISTANT_VERSION } from '../worker/browser-assistant.js'

// Compare with the PR base or the previous deployed-branch commit, not the merge commit's parent.
const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  : {}
const base = process.argv[2] || event.pull_request?.base?.sha || event.before
if (!base || /^0+$/.test(base)) {
  console.log('No previous revision supplied; assistant version check skipped.')
} else {
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Expected a full base commit SHA')
  const git = (args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const sources = [
    'worker/browser-assistant.js',
    'worker/browser-assistant-runtime.js',
    'worker/auth-bridge-script.js',
  ]
  const changed = git(['diff', '--name-only', base, 'HEAD', '--', ...sources])
  const existed = git(['ls-tree', '--name-only', base, '--', sources[0]])
  if (changed && existed) {
    const previous = git(['show', `${base}:${sources[0]}`]).match(
      /ASSISTANT_VERSION\s*=\s*['"]([^'"]+)['"]/,
    )?.[1]
    if (!previous || previous === ASSISTANT_VERSION)
      throw new Error('浏览器助手源码已变化，请同时修改 ASSISTANT_VERSION')
  }
  console.log('Assistant source/version check passed.')
}
