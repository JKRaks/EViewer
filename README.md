# jks-ehm

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

### 提取当前认证 Cookie

在「账号信息 → 认证信息 → 登录态」点击「提取 Cookie」，可查看并复制当前代理使用的
`ipb_member_id` 和 `ipb_pass_hash`。关闭结果、切换认证页签、切换账号或离开页面会清空提取内容。
需要同步更新前端和代理；已有 HttpOnly Cookie 无需重新保存。

导出接口为 `POST /ehentai/auth/export`，响应禁止缓存。来源仅接受同源、明确配置的前端完整
origin 及带端口的本地 HTTP 开发地址。多个 origin 用逗号分隔，不要包含路径或末尾斜杠：

```sh
# Node 代理
ALLOWED_ORIGINS="https://viewer.example.com,https://admin.example.com" node proxy-server.js
```

Cloudflare Worker 请使用 binding，无需修改 `ORIGIN_MAP`：

```toml
# wrangler.toml
[vars]
ALLOWED_AUTH_EXPORT_ORIGINS = "https://viewer.example.com,https://admin.example.com"
```

`proxy-server.workers.js` 仍是可单独部署的 Worker 入口，来源解析和判断函数也保持在该文件中，
不需要额外上传 JavaScript 依赖文件。

`VITE_EH_URL` 决定前端请求的代理地址；如果它与前端页面不同源，必须把**前端页面的
origin**（而不是 `VITE_EH_URL` 的值）加入 Node `ALLOWED_ORIGINS` 或 Worker
`ALLOWED_AUTH_EXPORT_ORIGINS`。例如页面为 `https://viewer.example.com/app`、
`VITE_EH_URL=https://proxy.example.com/ehentai`，应配置 `https://viewer.example.com`。通配符 `*`
仅可用于普通代理 CORS，绝不会授权 Cookie 导出。

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Workers Static Assets 迁移试运行

前端 `dist` 与原有代理由同一个 `eviewer-app` Worker 部署。固定 `pre` 分支使用原生 Worker Preview，`main` 使用 Production；功能分支 PR 仅构建和演练，先合入 `pre`，测试完成后再从 `pre` 合入 `main`。不会按 PR 或提交创建独立的代理 Worker。

试运行配置没有绑定生产自定义域名，原 Pages 项目与 `eproxy` 保留。迁移到同一自定义域名需要在测试通过后单独切换绑定；原来的 `pages.dev` 地址不能直接变成 Worker 的地址。`workers.dev` 测试地址是新域名，需要单独登录。

```sh
npm ci
npm ci --prefix deploy/eproxy
npm run build
npm run dev:worker
```

本地 Worker 使用 127.0.0.1:8787，支持 Vue 路由深链接。静态资源直接分发，`/ehentai`、`/exhentai`、`/github`、`/auth/*`、`/hentaiverse/*`、`/image-proxy`、`/health` 先进入原有代理；未知 API 返回 JSON 404，不回退到首页。`.assetsignore` 防止公开 Pages 路由配置和服务端 Worker 文件。

离线部署演练：

```sh
npm run deploy:cloudflare -- --dry-run --branch pre --commit 完整40位当前提交编号
npm run deploy:cloudflare -- --dry-run --branch main --commit 完整40位当前提交编号
```

原生 Preview 命令没有 dry-run，演练用其预发变量和绑定编译同一资源包；实际 `pre` 发布使用 `wrangler preview --name pre`，不会调用生产 `deploy`。Preview 的变量、版本元数据及限流绑定在 `previews` 中明确声明，资产和兼容性设置放在顶层。生产与预发使用不同的限流 namespace。

实际发布移除 `--dry-run`，要求工作区干净、当前 HEAD 与参数一致、`deployment.json` 中的前端构建提交一致，并配置 `CLOUDFLARE_API_TOKEN`。部署后检查 `/health` 与静态 `deployment.json` 的提交、环境及资产绑定。请求仅在发布时做有限验证，不在浏览器持续轮询。新旧页面仍需保持接口兼容，已打开的旧标签页不会因发布立即刷新。

GitHub Actions 使用仓库 Secret `CLOUDFLARE_API_TOKEN`，需目标账号的 Workers Scripts: Edit、Account Settings: Read 权限。PR 验证任务不读取 Token；发布任务只在 `pre` 或 `main` 推送后运行，并使用同一工作流构建的前端产物。不要同时开启重复的 Cloudflare 自动构建入口；若改用 Workers Builds，应关闭这条 Actions 发布任务。原生 Preview 需要 Wrangler 4.135.0 以上，本仓库固定 4.136.0。

### 备份与回退

迁移前已验证的代码位于远程标签 `backup/pages-before-static-assets-20261012-7c46097`，当前生产 Git main 另存为 `backup/main-before-static-assets-20261012-12d74ad`。完整 Git bundle 及 SHA-256 校验文件另保存在云工作区 `<private-backup-directory>/`；bundle 已通过 `git bundle verify`，不包含未跟踪的账号凭据或本地配置。迁移分支基于此版本，固定 `pre` 分支也从此版本建立。

原 Pages 发布脚本保留为 `deploy/cloudflare/pages-release.mjs`，可通过 `npm run deploy:pages` 调用；`functions/[[path]].js`、Pages 路由文件和 `deploy/eproxy/wrangler.jsonc` 保留。需要回到完整原方案时，从备份标签建立回退分支，按备份中的流程发布 Pages 和 eproxy，并同步恢复自定义域名绑定。切换域名前还需读取和保存 Cloudflare 的当前绑定、生产部署及设置；本地 Git 备份不包含这些云端配置。

Workers 新应用可独立回滚版本，静态资源与代理随同该版本回滚。试运行阶段无需删除原 Pages、eproxy 或历史预览 Worker，待新环境验证通过再安排清理。
