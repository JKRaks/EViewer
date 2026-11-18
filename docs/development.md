# 本地开发

## 技术栈

- Vue 3、TypeScript、Vue Router、Vue I18n
- Reka UI、Tailwind CSS 4、Lucide
- Vite 与 Cloudflare Workers
- IndexedDB 本地缓存、阅读历史
- PWA manifest 与 Service Worker

Node.js 要求 `>=22.12.0`，当前 CI 使用 Node.js 24。

## 安装依赖

```sh
npm ci
```

## 启动方式

### 只开发前端

```sh
npm run dev
```

需要有运行中的代理，使用 `VITE_EH_URL` 指向它。前端与代理不同源时，还要配置代理端的 origin 白名单，见[部署指南](deployment.md)。

### 启动前端构建与本地 Worker

```sh
npm run build
npm run dev:worker
```

默认地址是 `http://127.0.0.1:8787`。这个入口提供已构建的前端资源。

需要热更新时，另外运行 `npm run dev`，把它的 `VITE_EH_URL` 指向 Worker。修改静态构建内容后，需要重新构建才能在 Worker 入口看到更新。

本地认证使用测试账号或自己的授权会话。不要把真实 Cookie、API Token 或导出的认证字符串提交到仓库。

## 请求结构

服务代理模式：

```text
浏览器 → Cloudflare Worker（eviewer-app）
             ├─ 前端静态资源
             ├─ E-Hentai / ExHentai 代理
             ├─ 认证与浏览器助手相关接口
             └─ HentaiVerse 代理
```

本机代理模式：画廊和 HentaiVerse 请求通过浏览器助手使用当前浏览器的源站会话。模式由 `connectionSettings` 管理；本机失败不会自动回退服务代理。

认证、图片代理和源站路径必须经过 Worker，不能全按前端路由回退处理。相关路径见 `wrangler.jsonc` 的 `run_worker_first` 与 `vite.config.ts` 的 `navigateFallbackDenylist`。

## 目录

```text
src/
  components/             Vue 组件
    primitives/           业务组合控件
    settings/             设置页面组件
    hentaiverse/          HentaiVerse 界面
  core/
    auth/                 认证与会话
    books/                画廊、搜索、收藏
    cache/                本地缓存与阅读历史
    connector/            请求模式和浏览器助手协议
    hentaiverse/          游戏数据与操作逻辑
    theme/                主题与配色
  router/                 页面路由
  i18n/                   国际化
  views/                  页面
worker/                   Worker 支持模块
deploy/cloudflare/        发布脚本
docs/                     用户与维护文档
tool/                     开发工具
proxy-server.workers.js   代理逻辑
worker-app.js             Worker 入口
wrangler.jsonc            Workers 配置
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | Vite 开发服务器 |
| `npm run dev:worker` | 本地 Worker，需先构建前端 |
| `npm run build` | 类型检查与生产构建 |
| `npm run preview` | 预览前端构建，不等于完整代理环境 |
| `npm run type-check` | TypeScript 检查 |
| `npm run test:onboarding` | 首次连接引导的桌面与手机浏览器回归测试 |
| `npm run check:worker` | 代理和 Worker 入口语法检查 |
| `npm run lint` | ESLint 检查并自动修复，可能修改文件 |
| `npm run format` | 格式化 `src/`，会修改文件 |
| `npm run icons:generate` | 生成应用图标 |
| `npm run deploy:cloudflare -- --dry-run ...` | 发布打包演练，参数见部署指南 |

当前 CI 还运行 `node tool/check-assistant-version.mjs`，检查助手版本。涉及助手与认证协议的修改应一起核对脚本版本。

首次运行浏览器测试前执行 `npx playwright install chromium`。测试会启动本地 Vite，并拦截代理与源站请求，使用合成响应和助手协议，不需要真实账号。

## 开发工具与提交

推荐 VS Code 配合 Vue - Official，禁用旧 Vetur 插件；Vue Devtools 可用于查看组件状态。Chrome DevTools 可启用 Custom Object Formatter。

按[贡献指南](../CONTRIBUTING.md)从 `pre` 建立分支，PR 提交到 `pre`。UI 改动附截图或录屏，并注明设备、浏览器与验证路径。涉及登录、导航或多端界面的修改，应验证对应操作。

相关说明：[界面国际化](../src/i18n/README.md)、[界面字体](../src/assets/fonts/README.md)、[UI 来源](../src/components/ui/README.md)、[标签采集工具](../tool/README.md)。

[返回文档目录](README.md)
