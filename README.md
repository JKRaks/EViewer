# EViewer

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)

基于 Vue 3 + Vite 构建的 E-Hentai / ExHentai 网页阅读器，通过自部署反向代理访问原站，支持部署至 Cloudflare Workers。

## 功能

- **浏览**：首页推荐、昨日排行与 Toplists
- **搜索**：画廊搜索（支持标签选择器）
- **阅读**：图片阅读器、画廊详情与评论
- **收藏**：收藏夹管理、阅读历史
- **账号**：认证配置、Cookie 管理
- **资源**：种子下载、画廊分享（生成二维码）
- **HentaiVerse**：战斗面板集成、装备与技能管理
- **主题**：深色 / 浅色主题切换
- **PWA**：离线访问支持

## 技术栈

- **前端**：Vue 3、TypeScript、Vue Router、Pinia、Element Plus
- **构建**：Vite 7、vue-tsc
- **代理**：Cloudflare Workers（生产与本地开发）
- **存储**：IndexedDB（`idb`）、localStorage
- **部署**：Cloudflare Workers Static Assets

## 架构概述

前端通过 `VITE_EH_URL` 指向的代理地址发送请求，代理转发至 E-Hentai / ExHentai 并附加认证 Cookie。生产环境中前端静态资源与代理由同一个 `eviewer-app` Worker 提供服务。

```
浏览器 → Cloudflare Worker (eviewer-app)
              ├── /              → Vue SPA 静态资源
              ├── /ehentai/*     → 代理 e-hentai.org
              ├── /exhentai/*    → 代理 exhentai.org
              ├── /auth/*        → 认证接口
              └── /hentaiverse/* → HentaiVerse 接口
```

## 本地开发

### 前置要求

- Node.js `>=22.12.0`（推荐 Node.js 24）

### 安装

```sh
npm ci
```

### 启动 Vite 开发服务器

```sh
npm run dev
```

需要一个运行中的代理实例，将 `VITE_EH_URL` 指向它（默认可用下方 Worker 开发服务器）。

### 启动本地 Cloudflare Worker 开发服务器

同时运行前端资产与代理逻辑，地址为 `http://127.0.0.1:8787`，支持 Vue Router 深链接。

```sh
npm ci
npm run build
npm run dev:worker
```

如需热更新开发，可另启动 Vite 开发服务器（`npm run dev`）并将 `VITE_EH_URL` 指向 Worker 地址。

## 认证配置

代理使用 `ipb_member_id` 和 `ipb_pass_hash` Cookie 访问原站。在应用的「账号信息 → 认证信息 → 登录态」页面中填写并保存，或通过「提取 Cookie」按钮查看当前值。

认证导出接口为 `POST /ehentai/auth/export`，仅接受同源或明确配置的 origin。

**Cloudflare Worker（`wrangler.jsonc`）：**

```jsonc
"vars": {
  "ALLOWED_AUTH_EXPORT_ORIGINS": "https://viewer.example.com"
}
```

> `VITE_EH_URL` 与前端页面不同源时，应将**前端页面的 origin** 加入允许列表，而不是 `VITE_EH_URL` 的值。

## 部署（Cloudflare Workers）

### 一次性准备

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_API_TOKEN`，需具备 Workers Scripts: Edit、Account Settings: Read 及目标区域的相关权限。
2. 保持 `main` 为生产分支，`pre` 为预发分支。
3. 关闭 Cloudflare 控制台的自动构建，由本仓库 CI 统一发布。

### 发布流程

推送至 `pre` 或 `main` 后，GitHub Actions（`.github/workflows/cloudflare-release.yml`）自动构建并部署。

手动发布演练（不实际上传）：

```sh
npm run deploy:cloudflare -- --dry-run --branch main --commit <完整40位提交编号>
```

实际发布移除 `--dry-run` 并确保工作区干净、已通过 `wrangler login` 或设置 `CLOUDFLARE_API_TOKEN`。

### 分支规则

| 推送目标 | Worker 名称 |
|---------|------------|
| `main`  | `eviewer-app`（生产） |
| `pre`   | `eviewer-app` Preview |
| 功能分支 PR | 仅构建和演练，合入 `pre` 后测试 |

## 项目结构

```
EViewer/
├── src/
│   ├── components/       # Vue 组件
│   │   └── hentaiverse/  # HentaiVerse 相关组件
│   ├── composables/      # 可组合函数
│   ├── core/             # 核心业务逻辑
│   │   ├── auth/         # 认证相关
│   │   ├── books/        # 画廊管理
│   │   ├── cache/        # 缓存策略
│   │   ├── data/         # 数据层
│   │   └── hentaiverse/  # HentaiVerse 逻辑
│   ├── router/           # Vue Router 路由
│   ├── views/            # 页面视图
│   └── App.vue           # 根组件
├── deploy/cloudflare/    # Cloudflare 部署脚本
├── tool/                 # 标签组采集工具
├── proxy-server.workers.js  # Cloudflare Worker 代理逻辑
├── worker-app.js         # Worker 入口（静态资源 + 代理）
└── wrangler.jsonc        # Wrangler 配置
```

## 其他命令

```sh
npm run type-check      # TypeScript 类型检查
npm run check:worker    # Worker 代码检查
npm run lint            # ESLint 自动修复
npm run format          # Prettier 格式化 src/
npm run build           # 生产构建
npm run preview         # 预览构建产物
```

## 版本管理

项目使用 `pre` 分支进行预发环境测试，通过验证后合并到 `main` 生产分支。Cloudflare Workers 支持版本回滚，可在 Workers 控制台的「Deployments」选项卡或通过 Wrangler CLI 操作。

## 开发环境推荐

- **编辑器**：[VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（禁用 Vetur）
- **浏览器扩展**：[Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)（Chromium）/ [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)（Firefox）
- 在 Chrome DevTools 中开启 [Custom Object Formatter](http://bit.ly/object-formatters) 以获得更好的 Vue 对象展示

## 贡献

欢迎提交 Issue 和 Pull Request。贡献代码前请确保：

- 代码通过 `npm run lint` 和 `npm run type-check`
- 遵循项目现有代码风格
- PR 描述清楚改动内容和原因

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 相关文档

- [标签组采集工具](tool/README.md) - 从 E-Hentai 采集标签分类数据
- [贡献指南](CONTRIBUTING.md) - 如何为项目贡献代码

## License

本项目采用 [GNU General Public License v3.0](LICENSE.txt) 开源协议。
