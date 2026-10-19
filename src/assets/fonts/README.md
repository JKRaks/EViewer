# 界面字体

## 字体分工

- **标题装饰**：`--font-display`，优先使用得意黑，原生 400 字重，关闭伪粗体。适用于大标题、Banner、导航、卡片大数字等场景。
- **正文阅读**：`--font-body`，优先使用阿里巴巴普惠体 3.0。正文使用 Regular 400，标签、控件与强调文字使用 Medium 500。适用于正文、表格、表单、提示、HentaiVerse 战斗日志等场景。
- **字标独立**：`EViewer.` 字标使用 Georgia 斜体。

正文基准字号为 `15px / 1.7`，表单标签和常规反馈为 `14px`。密集数字保留等宽数字布局。所有平台采用相同的字体分工，PingFang 作为缺字或加载时的后备字体。

## 阿里巴巴普惠体 3.0

### 来源信息

- **官方来源**：[阿里巴巴字体官网](https://www.alibabafonts.com/)
- **字体文件**：官方 `fonts.alibabadesign.com` WebFont 分包
- **字重版本**：55 Regular（400）与 65 Medium（500），各 6 个 WOFF2 分包，总计 2,876,336 字节
- **官方 CSS**：[Regular](https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/AlibabaPuHuiTi-3-55-Regular/AlibabaPuHuiTi-3-55-Regular.css) | [Medium](https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/AlibabaPuHuiTi-3-65-Medium/AlibabaPuHuiTi-3-65-Medium.css)

### 使用说明

字体二进制文件保持官方原样，仅在本地重新命名。CSS 统一了字体族名和真实字重，保留官方 `unicode-range`，按字符及字重按需加载分包。官方分包未覆盖的字符使用系统后备字体。

每个文件的官方 URL、大小、SHA-256 见[来源清单](alibaba-sources.json)。完整的[中英文法律声明](AlibabaPuHuiTi3-LICENSE.txt)来自[官网原文](https://www.yuque.com/yiguang-wkqc2/hgpff0/nus9wiinq4aeiegy)。

## 得意黑 / Smiley Sans

- **官方仓库**：[atelier-anchor/smiley-sans v2.0.1](https://github.com/atelier-anchor/smiley-sans/releases/tag/v2.0.1)
- **原始文件**：发布包中的 `SmileySans-Oblique.ttf.woff2`
- **项目命名**：`SmileySans-Oblique.woff2`，未修改字体内容
- **文件大小**：1,150,924 字节
- **SHA-256**：`731f22973349404b15a88a99ef3b5dd4104c0965c23b7e485c1f11e84fea99e2`
- **许可证**：[SIL Open Font License 1.1](OFL.txt)

## 字体加载

两种字体均本地打包、使用 `font-display: swap`，不依赖远程字体服务。PWA 仅在字体实际使用后缓存分包，不将全部字体放入安装预缓存。

字体声明独立为 `interface-fonts.css`，不由 `main.css` 同步引入。首屏 CSS 和 HTML 均不引用字体文件，页面先用系统后备字体显示。字体 CSS 和 WOFF2 文件均不进入 PWA 安装预缓存，实际使用后进入独立字体缓存。
