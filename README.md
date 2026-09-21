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
