# UI 来源

基础组件通过官方 shadcn-vue CLI 的 `new-york` registry 于 2025-10-18 引入，源码由项目维护。

- 上游：https://github.com/unovue/shadcn-vue（MIT）
- 安装说明：https://www.shadcn-vue.com/docs/installation/vite
- 无样式交互由 Reka UI 提供；图标使用 Lucide。
- 项目调整了本地 `cn` 路径、中文关闭文案与语义配色；业务级控件在 `../primitives/` 中组合实现。

HentaiVerse 场景和像素图标由项目直接绘制 SVG，使用同一套全局界面字体。
