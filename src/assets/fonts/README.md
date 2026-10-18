# 界面字体

## 使用分工

- 大标题、Banner、导航、卡片大数字：`--font-display`，优先得意黑，使用原生 400 字重，关闭伪粗体。
- 正文、表格、表单、提示、HentaiVerse 战斗日志：`--font-body`，优先阿里巴巴普惠体 3.0。正文 Regular 400，标签、控件与强调文字 Medium 500；不把整页正文统一加粗。
- 正文基准 `15px / 1.7`，表单标签和常规反馈 `14px`；密集数字保留等宽数字布局。苹果和其他设备采用相同的用途分工，PingFang 仅作为缺字/加载时的后备。
- `EViewer.` 字标继续独立使用 Georgia 斜体。

## 阿里巴巴普惠体 3.0

- 来源：[阿里巴巴字体官网](https://www.alibabafonts.com/)，官网下载代码列出的官方 `fonts.alibabadesign.com` WebFont 分包。
- 字重：55 Regular（400）与 65 Medium（500），各 6 个 WOFF2 分包，共 2,876,336 字节。
- [Regular 官方 CSS](https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/AlibabaPuHuiTi-3-55-Regular/AlibabaPuHuiTi-3-55-Regular.css)、[Medium 官方 CSS](https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/AlibabaPuHuiTi-3-65-Medium/AlibabaPuHuiTi-3-65-Medium.css)。
- 字体二进制保持官方原样，仅在本地重新命名。没有转换格式、修改轮廓或自行裁剪；CSS 统一字体族名和真实字重，保留官方 `unicode-range`，按字符及字重加载分包。官方分包未覆盖的字符使用系统后备字体。
- 每个文件的官方 URL、大小、SHA-256 见 [来源清单](alibaba-sources.json)。
- 保留[完整中英文法律声明](AlibabaPuHuiTi3-LICENSE.txt)，来自[官网链接的原文](https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy)。

两种字体均本地打包、`font-display: swap`，不依赖远程字体服务。PWA 仅在字体实际使用后缓存分包，不将全部字体放入安装预缓存。

## 首次加载

- 字体声明独立为 `interface-fonts.css`，不再由 `main.css` 同步引入。首屏 CSS 和 HTML 均不引用字体文件，页面先用系统后备字体显示。
- `src/lib/interfaceFonts.ts` 在初始路由就绪、窗口 load 和两次绘制帧后，通过 requestIdleCallback 延后导入字体 CSS；不支持该 API 时使用 300ms 定时回退。字体仍按实际字符/字重加载，失败时保持系统字体。
- 字体 CSS 和 WOFF2 均不进入 PWA 安装预缓存；实际使用后进入独立字体缓存。
- 分享卡按操作请求二维码库，并主动加载字体声明与导出文字需要的字形后再绘制 Canvas；不会为了导出而让全站启动等待字体。

## 得意黑 / Smiley Sans

- 来源：[atelier-anchor/smiley-sans v2.0.1](https://github.com/atelier-anchor/smiley-sans/releases/tag/v2.0.1)
- 原文件：发布包中的 `SmileySans-Oblique.ttf.woff2`，项目内命名为 `SmileySans-Oblique.woff2`，未修改字体内容。
- 大小：1,150,924 字节。
- SHA-256：`731f22973349404b15a88a99ef3b5dd4104c0965c23b7e485c1f11e84fea99e2`。
- 许可：[SIL Open Font License 1.1](OFL.txt)，保留发布仓库的完整许可。
