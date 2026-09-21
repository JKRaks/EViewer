# eproxy 自动部署

此目录仅部署仓库根目录的 `proxy-server.workers.js` 到 Cloudflare Worker `eproxy`。
入口脚本保持单文件、无模块依赖；Wrangler 禁用打包和额外模块扫描，也未配置静态资源。
前端继续由 Pages 的 `eviewer` 项目从仓库根目录执行 `npm run build` 并发布 `dist`。

## Workers Builds 设置

- 仓库：`JKRaks/EViewer`
- 生产分支：`main`；分支包含规则仅为 `main`
- 根目录：`deploy/eproxy`
- 构建命令：`npm run check`
- 部署命令：`npm run deploy`
- 包含路径：`proxy-server.workers.js`、`auth-export-origin.test.js`、`deploy/eproxy/**`
- 排除路径：`deploy/eproxy/README.md`

路径规则相对于仓库根目录。仅前端文件变动不会触发 Worker 部署。
Workers Builds 在此目录安装独立的锁定依赖，不调用前端的构建脚本。
现有 Pages 流水线仍按它自己的路径规则运行。

## 本地检查

```sh
cd deploy/eproxy
npm ci
npm run check
```

`dist/proxy-server.workers.js` 应与仓库入口脚本完全一致，且产物不包含前端静态资源。
授权后的手动发布使用 `npm run deploy`，无需先构建前端。

## 配置与回滚

Wrangler 配置保留接入 CI/CD 前的兼容日期、兼容标志、智能位置、域名、日志及速率限制绑定。
认证导出仅信任当前 Pages 生产域名 `https://viewer.example.com` 与 `https://viewer.example.com`；
新增正式前端域名时同步更新 `vars.ALLOWED_AUTH_EXPORT_ORIGINS`，不使用预览域名通配符。
修改代理入口或新增导入时，应同时更新部署配置和包含路径。
在 Cloudflare 的版本历史中选择上一个正常版本回滚，并修复或回退相应 Git 提交，
避免下次推送再次发布故障版本。
