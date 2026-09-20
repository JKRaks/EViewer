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

导出接口为 `POST /ehentai/auth/export`，响应禁止缓存。来源仅接受同源、明确配置的前端来源及
本地 HTTP 开发地址。跨域部署时，Node 代理在 `ALLOWED_ORIGINS` 环境变量中填写前端完整 origin
（多个用逗号分隔）；Cloudflare Workers 在 `ORIGIN_MAP` 的 `allowedOrigins` 中填写。
例如 `https://viewer.example.com`；通配符 `*` 不会授权提取认证信息。

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
