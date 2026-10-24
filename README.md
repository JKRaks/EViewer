# EViewer

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)

E-Hentai / ExHentai 网页阅读器，通过自部署反向代理访问原站。

## 功能

- 浏览首页推荐、昨日排行与 Toplists
- 高级搜索，标签包含与排除筛选
- 连续滚动阅读，进度恢复，图片失败重试
- 收藏夹管理，阅读历史
- 种子下载，画廊分享二维码
- HentaiVerse 角色、装备、物品、能力及战斗管理
- 深色/浅色主题
- 中文/英文界面
- PWA 支持

## 技术栈

- Vue 3、TypeScript、Vue Router、Vue I18n
- Reka UI、Tailwind CSS 4、Lucide
- Cloudflare Workers 代理
- IndexedDB 缓存
- Vite 构建

## 架构

浏览器通过代理访问原站，前端与代理由同一个 Worker 提供：

```
浏览器 → Cloudflare Worker (eviewer-app)
              ├── /              → 前端静态资源
              ├── /ehentai/*     → e-hentai.org
              ├── /exhentai/*    → exhentai.org
              ├── /ehentai/auth/* → 认证接口
              └── /hentaiverse/* → HentaiVerse
```

## 本地开发

### 前置要求

Node.js `>=22.12.0`

### 安装

```sh
npm ci
```

### 启动前端开发服务器

```sh
npm run dev
```

需要运行中的代理实例，`VITE_EH_URL` 指向代理地址。

### 启动完整开发环境

同时运行前端与代理，地址 `http://127.0.0.1:8787`：

```sh
npm run build
npm run dev:worker
```

热更新开发时可另启动 `npm run dev`，将 `VITE_EH_URL` 指向 Worker 地址。

## 认证配置

代理使用 `ipb_member_id` 和 `ipb_pass_hash` Cookie 访问原站。在应用的「账号信息 → 认证信息 → 登录态」填写并保存。

前端与代理不同源部署时，需将前端 origin 加入白名单。`ALLOWED_ORIGINS` 和 `ALLOWED_AUTH_EXPORT_ORIGINS` 在 Cloudflare Worker 中以 Secret 维护；部署时保留 `keep_vars: true`，不要在仓库或 CI 中写入这些值。

## 浏览器助手

浏览器助手可使用当前浏览器的源站登录状态访问 E-Hentai、ExHentai 和 HentaiVerse，无需手动配置 Cookie。

前往「系统设置 → 浏览器助手」安装脚本，根据你的环境选择对应版本：

- **Tampermonkey**（桌面浏览器）：点击安装链接，确认权限后刷新页面
- **Userscripts**（iOS/iPadOS Safari）：在 Userscripts App 中启用 Safari 扩展，点击安装链接后从扩展菜单确认

安装后选择「本机助手」，在同一浏览器登录源站，再前往「账号信息」检测登录状态。脚本安装和更新统一在设置中完成；使用 ExHentai 需具备源站访问权限。

## 部署（Cloudflare Workers）

### 准备

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
2. `main` 为生产分支，`pre` 为预发分支
3. 关闭 Cloudflare 控制台的自动构建

### 发布

推送至 `pre` 或 `main` 后，GitHub Actions 自动构建并部署。

构建演练：

```sh
npm ci
npm run build
npm run check:worker
npm run deploy:cloudflare -- --dry-run --branch pre --commit <40位提交编号>
npm run deploy:cloudflare -- --dry-run --branch main --commit <40位提交编号>
```
实际发布需先提交全部修改并使用当前 HEAD 重新构建，再去掉 `--dry-run`；通过安全环境变量提供 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

| 分支 | Worker |
| --- | --- |
| `main` | `eviewer-app` 生产 |
| `pre` | `eviewer-app` Preview |

## 项目结构

```
EViewer/
├── src/
│   ├── components/       # Vue 组件
│   │   ├── primitives/   # 业务组合控件
│   │   └── hentaiverse/  # HentaiVerse 组件
│   ├── core/             # 核心逻辑
│   │   ├── auth/         # 认证
│   │   ├── books/        # 画廊
│   │   ├── cache/        # 缓存
│   │   └── hentaiverse/  # HentaiVerse
│   ├── router/           # 路由
│   ├── i18n/             # 国际化
│   └── views/            # 页面
├── deploy/cloudflare/    # 部署脚本
├── docs/                 # 文档
├── tool/                 # 工具脚本
├── proxy-server.workers.js  # 代理逻辑
├── worker-app.js         # Worker 入口
└── wrangler.jsonc        # Wrangler 配置
```

## 命令

```sh
npm run dev              # Vite 开发服务器
npm run dev:worker       # Worker 开发服务器
npm run build            # 生产构建
npm run preview          # 预览构建
npm run type-check       # TypeScript 检查
npm run check:worker     # Worker 代码检查
npm run lint             # ESLint 修复
npm run format           # Prettier 格式化
npm run icons:generate   # 生成应用图标
```

## 版本管理

使用 `pre` 分支测试，验证后合并到 `main`。Cloudflare Workers 支持版本回滚。

## 开发环境

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（禁用 Vetur）
- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- Chrome DevTools 开启 [Custom Object Formatter](http://bit.ly/object-formatters)

## 贡献

提交 Issue 和 Pull Request 前确保：

- 通过 `npm run lint` 和 `npm run type-check`
- 遵循项目代码风格
- PR 描述清楚改动内容

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 文档

- [贡献指南](CONTRIBUTING.md)
- [标签采集工具](tool/README.md)
- [界面国际化](src/i18n/README.md)
- [界面字体](src/assets/fonts/README.md)
- [UI 来源](src/components/ui/README.md)

## License

[GNU General Public License v3.0](LICENSE.txt)
