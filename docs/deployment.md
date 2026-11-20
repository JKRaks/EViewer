# Cloudflare Workers 部署

EViewer 的前端静态资源和代理由同一个 Cloudflare Worker 提供。仓库使用 `pre` 和 `main` 两个固定发布分支。

## 准备

- Node.js `>=22.12.0`。当前 GitHub Actions 使用 Node.js 24。
- Cloudflare 账号及可供部署使用的 API Token。
- 启用了 Actions 的代码仓库。

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 发布凭据 |
| `CLOUDFLARE_ACCOUNT_ID` | 目标账号 |

不要把凭据写进源码、命令示例或构建产物。若已在 Cloudflare 控制台配置自动构建，应关闭该入口，由仓库 Actions 统一发布，避免两条流程同时部署。

## 发布分支

| 分支或事件 | 行为 |
| --- | --- |
| PR 指向 `pre` 或 `main` | 构建与校验，不发布 |
| 推送 `pre` | 发布 `eviewer-app` 的固定 `pre` Preview |
| 推送 `main` | 发布 `eviewer-app` 生产环境 |

日常改动先提交到 `pre`，在预发环境确认后再合入 `main`。Preview 名称固定为 `pre`，发布脚本会校验目标和返回的部署信息。

## Worker 配置

`wrangler.jsonc` 指定入口 `worker-app.js`，静态资源目录为 `dist`。配置还包含认证桥接使用的 Durable Object、迁移项、限流和日志设置。这些绑定供运行时使用。

生产自定义域名需要单独配置；仓库中的 `routes` 默认是空数组。

前端与代理不同源部署时，需要在 Worker 的 Secret 中维护：

- `ALLOWED_ORIGINS`：允许访问代理的前端 origin。
- `ALLOWED_AUTH_EXPORT_ORIGINS`：认证导出相关的 origin 白名单。

保留 `keep_vars: true`，避免发布时覆盖 Cloudflare 管理的绑定。不要将白名单实际值写入仓库或 CI 配置；只加入你管理、信任的前端地址。

## 本地构建演练

在完整 Git 检出中执行：

```sh
npm ci
npm run build
npm run check:worker
npm run deploy:cloudflare -- --dry-run --branch pre --commit <40位提交编号>
npm run deploy:cloudflare -- --dry-run --branch main --commit <40位提交编号>
```

把 `<40位提交编号>` 替换为 `git rev-parse HEAD` 的结果。构建会生成 `dist/deployment.json`，记录所用提交；发布脚本要求它与传入提交一致。

`--dry-run` 只执行构建和打包检查。原生 Preview 没有对应的 dry-run 发布入口，脚本会用 Preview 配置执行构建演练。

## 实际发布

推荐通过分支推送触发已有 Actions。确需本地发布时，先提交所有修改，确认当前 HEAD，重新构建，再去掉演练命令中的 `--dry-run`。通过安全环境变量提供两个 Cloudflare 凭据，不要把 Token 直接写进终端命令历史。

实际发布要求工作树干净且提交编号与 HEAD 一致。下载 ZIP 后构建可以用于检查前端，但不满足这里的 Git 发布要求。

## 发布检查与回滚

脚本发布后会检查 `/health` 与 `/deployment.json` 的版本信息，Preview 还会核对别名与部署目标。CI 通过后仍应在目标环境检查首页、账号状态及所用连接方式。

Cloudflare Workers 支持版本回滚。回滚后同时检查前端与代理版本、浏览器缓存和助手版本，避免旧页面配上新脚本。

## 相关文件

- [发布工作流](../.github/workflows/cloudflare-release.yml)
- [发布脚本](../deploy/cloudflare/release.mjs)
- [Wrangler 配置](../wrangler.jsonc)
- [本地开发](development.md)

[返回文档目录](README.md)
