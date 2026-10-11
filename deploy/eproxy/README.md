# Pages 与 eproxy 自动发布

发布入口为仓库的 `.github/workflows/cloudflare-release.yml`，由同一提交依次构建前端、检查 Worker、编译并核对 Pages 绑定、发布 Worker、发布 Pages，最后通过新部署的 `/health` 核对提交编号与环境。

| 来源                 | Worker                      | Pages 的 EPROXY       |
| -------------------- | --------------------------- | --------------------- |
| 推送 main            | eproxy，保留生产域名与配置  | eproxy                |
| 本仓库 PR 更新       | eproxy-pr-PR编号-提交前16位 | 该次提交的独立 Worker |
| 手动运行非 main 分支 | eproxy-preview-提交前16位   | 该次提交的独立 Worker |

预发 Worker 没有公开域名，只能经服务绑定调用。不同 PR 和旧的预览部署保持独立。关闭 PR 时先删除属于该分支与提交的 Pages 预览部署，再删除该 PR 的预发 Worker；生产和其他 PR 不参与清理。Fork PR 不执行带凭据的发布。

## Cloudflare 支持与实现方式

[Pages 配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#configure-environments)支持 `production` 与 `preview` 两种环境和服务绑定，控制台的预览设置对全部预览分支共用，不提供按分支的独立配置。

[Workers Preview 的服务绑定限制](https://developers.cloudflare.com/workers/previews/resources/#service-bindings)是调用目标 Worker 的生产部署，不会自动对应目标 Worker 的同名 Preview。因此这里创建实际的独立 Worker，而不是绑定 Preview URL，也不使用 URL 代理。

`deploy/cloudflare/release.mjs` 为当前 Pages 上传生成带 `EPROXY` 的 Wrangler 配置。固定版本 Wrangler 4.136.0 将服务目标和提交编号写入该次上传的 Functions bundle 元数据；脚本在发布前解析上传产物确认绑定。配置与产物在临时目录中生成并清理，仓库没有按分支不断改写的配置文件。原有 Git 集成的 Pages 项目可以使用 Wrangler 上传，无需另建项目。

## 一次性启用

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_API_TOKEN`。Token 需具备目标账户的 **Cloudflare Pages: Edit**、**Workers Scripts: Edit**、**Account Settings: Read**，以及生产 `c-h.cc` 区域的 **Zone: Read**、**Workers Routes: Edit** 权限。账户 ID 与项目名已沿用现有配置。
2. 保持 Pages 项目 `eviewer` 的生产分支为 `main`。脚本发布前会检查，不符合时停止。
3. 关闭 Pages Git 集成的生产和预览自动构建；关闭 `eproxy` 原来的 Workers Builds 自动构建。保留 Git 关联。由本流水线统一发布，避免旧流水线另行覆盖 Worker 或发布绑定旧服务的 Pages。
4. 将本流水线合并进 `main`，然后更新或重新打开本仓库 PR。也可在 **Actions → Cloudflare release → Run workflow** 选择已含脚本的分支手动发布；有对应 PR 时填写 PR 编号，以共用发布队列与关闭后的清理规则，生产发布留空。

当前云环境的 Token 不会自动成为 GitHub Actions Secret；两处凭据分别用于本地验证/发布与持续集成。Token 值不应写入源码、配置或日志。

Pages 上传配置包含当前 Functions 实际使用的 `EPROXY` 和版本变量。如果以后新增运行时绑定，请一并加入 `releasePlan` 中的 Pages 配置。

## 本地演练

```sh
npm ci
npm ci --prefix deploy/eproxy
npm run build
npm run check --prefix deploy/eproxy
npm run deploy:cloudflare -- --dry-run --branch feature/example --pr 11 --commit 完整40位提交编号
```

演练不需要登录，也不会发布；会检查 Worker 部署产物以及实际 Pages Functions 上传包内的绑定。只检查生产配置时将 `--branch` 设为 `main`，省略 `--pr`。

实际发布使用同一命令移除 `--dry-run`，并安全设置 `CLOUDFLARE_API_TOKEN`。脚本要求工作区干净且提交编号等于当前 HEAD。使用网络代理的 Node 24 环境可设置 `NODE_USE_ENV_PROXY=1`。

## 更新、失败与回滚

所有前端或代理代码更新都触发同一流水线，Worker 发布失败会阻止 Pages 发布，避免新前端绑定旧代理。部署后的版本检查是一次性发布检查，不会在浏览器中持续请求。

Pages 向 Worker 转发其部署提交编号；若生产发布期间仍有旧 Pages Functions 调用刚更新的 Worker，Worker 会在执行请求前返回明确的版本未同步错误。生产 Worker 与 Pages 仍是两个发布动作，没有跨服务原子事务；Pages 发布失败时需修复后重新运行该提交的流水线，或同时回滚两者。

PR 预览保留旧提交对应的 Worker，直到 PR 关闭。生产回滚应同步使用旧提交发布 Worker 与 Pages；只回滚其中一个会被版本检查拦截。现有 `deploy/eproxy` 的 `npm run deploy` 仍可用于单独人工处理 Worker，但不是日常自动发布入口。
