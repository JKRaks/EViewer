# 原站授权登录

成功标准是读取并保存 `ipb_member_id` 和 `ipb_pass_hash`。授权流程不访问源站账户接口；源站封禁、限流或账户页面加载失败不改变凭据同步结果。

## 使用方法

1. 在账户页展开“首次使用：安装授权脚本”。桌面及支持扩展的 Android 浏览器使用 Tampermonkey；Safari 使用 Userscripts。
2. Tampermonkey 可直接安装。Safari 下载 `.user.js` 到 Userscripts 指定目录，启用脚本并允许访问 `e-hentai.org`。在线安装失败时可下载文件或复制源码。
3. 在装有脚本的浏览器登录原站，再在 EViewer 点击“开始原站授权”。
4. 打开授权链接，在原站浮层确认接收地址，点击“授权同步登录凭据”。
5. 返回发起请求的 EViewer，页面自动领取并显示“登录凭据已同步”。

PWA 或没有扩展的浏览器可复制授权链接到辅助浏览器。接收权限保留在原来的 EViewer 中，不依赖浏览器之间共享 Cookie。配对有效期五分钟；浏览器回到前台后继续检查。原站重新登录或切换账户后，再同步一次即可。

## 部署

`wrangler.jsonc` 新增 SQLite-backed `AUTH_BRIDGE` Durable Object 和 `auth-bridge-v1` migration；入口导出 `AuthBridgeSession`。继续使用项目原有 pre/main 发布流程。首次发布必须应用 migration，不要手工删除已发布的 migration 历史。

不需要配置长期私钥、购买扩展或开通 Browser Run。每次配对生成临时 RSA 公钥，私钥用接收浏览器 HttpOnly 配对密钥进行 AES-GCM 加密。Durable Object 仅暂存密文、校验摘要和过期时间；过期 alarm 清除临时数据。Workers Free 支持 SQLite-backed Durable Objects，超过免费限额会失败；不要为此自动升级套餐。

生产使用 HTTPS，并在正式 EViewer 域名安装对应脚本。脚本固定接收域名，不接受票据指定的其他回调地址。前后端分离时继续配置现有完整 Origin 白名单及允许 Cookie 的 CORS；Safari 等浏览器可能限制第三方 Cookie，因此推荐前端与代理同源部署。

缺少绑定时，页面提示使用手动输入，原有 Cookie 导入及导出功能仍可使用。退出或手动替换凭据会取消当前配对；退出 EViewer 不退出原站。

## 协议与数据

- `/auth/bridge/start` 创建配对，接收端持有短期 HttpOnly 密钥；授权链接只包含公钥和单次上传票据。
- 原站脚本使用标准 DOM/Web Crypto、`@grant none`，只在带授权标记的账户首页运行。显式授权后提交 RSA-OAEP + AES-GCM 密文。
- `/auth/bridge/receive` 只接受原站表单来源，校验单次上传票据；不读取或安装授权浏览器的 EViewer 认证。
- `/auth/bridge/status` 仅向绑定的接收端返回状态。`claim` 解密并复用现有 Cookie 校验及 HttpOnly 写入逻辑。
- 接收端通过 `/ehentai/auth/status` 确认两项 Cookie 已实际保存，再调用 `cancel` 清理配对。网络中断时原接收端可以在过期前重试领取。
- Cookie 值不进入 URL、日志、localStorage、IndexedDB 或普通状态响应。localStorage 继续仅保存会员 ID 等登录提示。
- 用户脚本是独立源码文本，不从打包后的函数 `toString()` 生成。

## 验证

```sh
npm run type-check
npm run check:worker
npm run build
```
