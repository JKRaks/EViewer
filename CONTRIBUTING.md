# 贡献指南 / Contributing Guide

感谢你考虑为 EViewer 贡献代码！

Thank you for considering contributing to EViewer!

## 开发流程 / Development Workflow

### 1. Fork 与克隆 / Fork and Clone

```bash
git clone https://github.com/your-username/EViewer.git
cd EViewer
git remote add upstream https://github.com/JKRaks/EViewer.git
```

### 2. 创建分支 / Create a Branch

从 `pre` 创建功能分支（项目约定所有改动先合并到 `pre` 预发分支，经所有者审查后再合并至 `main` 生产分支）：

```bash
git checkout pre
git pull upstream pre
git checkout -b feature/your-feature-name
```

命名建议：
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 重构
- `perf/` - 性能优化

### 3. 本地开发 / Local Development

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev              # Vite 开发服务器
npm run dev:worker       # 本地 Worker（包含前端与代理）
```

> **注意**：`dev:worker` 需要先运行 `npm run build` 构建前端资产。

### 4. 代码规范 / Code Standards

提交前请确保：

```bash
npm run lint            # 运行 ESLint 自动修复
npm run format          # 运行 Prettier 格式化
npm run type-check      # TypeScript 类型检查
npm run build           # 构建成功
```

**代码风格：**
- 遵循项目现有代码风格和命名约定
- TypeScript 类型标注完整
- 组件和函数职责单一
- 复杂逻辑添加必要注释

### 5. 提交信息 / Commit Messages

使用清晰的提交信息，推荐格式：

```
<type>(<scope>): <subject>

<body>
```

**Type 类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建或工具变动

**示例：**
```
feat(viewer): add zoom controls to image viewer

Add zoom in/out buttons and keyboard shortcuts (+ / -) to the image viewer.
Resolves #123
```

### 6. 提交 Pull Request / Submit a Pull Request

```bash
git push origin feature/your-feature-name
```

**重要：PR 应提交到 `pre` 分支，而非 `main`。**

在 GitHub 上创建 PR 时：

1. **目标分支**：选择 `pre` 作为 base 分支
2. **标题清晰**：简要描述改动内容
3. **描述完整**：
   - 改动的目的和背景
   - 主要变更内容
   - 测试方法（如适用）
   - 相关 Issue 编号
4. **截图/录屏**（如涉及 UI 改动）
5. **检查 CI 状态**：确保所有检查通过

**分支策略说明：**
- 功能分支 → `pre`：所有新功能和修复先合并到预发环境
- `pre` → `main`：经所有者在预发环境充分测试后，由维护者将 `pre` 合并到生产分支

### 7. 代码审查 / Code Review

维护者会审查你的代码并可能提出修改建议。请：

- 及时回应反馈
- 根据建议修改代码
- 保持讨论友好和专业

## 报告问题 / Reporting Issues

发现 Bug 或有功能建议？请在 [Issues](https://github.com/JKRaks/EViewer/issues) 中提交。

**Bug 报告应包含：**
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（浏览器版本、操作系统等）
- 截图或错误日志（如有）

**功能建议应包含：**
- 功能描述
- 使用场景
- 预期效果
- 可能的实现思路（可选）

## 开发注意事项 / Development Notes

### 认证测试

本地开发需要配置代理的认证信息。不要将真实的 Cookie 提交到仓库。

### Cloudflare Workers 部署

项目使用双环境部署策略：

- **功能分支 PR**：只触发构建和验证（`validate` job），不会自动部署
- **合并到 `pre`**：自动部署到 Cloudflare Workers Preview 环境（`.github/workflows/cloudflare-release.yml` 的 `release` job）
- **合并到 `main`**：由项目所有者操作，部署到生产环境

开发者应：
1. 提交 PR 到 `pre` 分支
2. 确保 CI 验证通过
3. 等待代码审查
4. PR 合并后，在 Preview 环境测试你的改动
5. 后续由维护者统一将 `pre` 合并到 `main`

### 前端代理分离

生产环境中前端和代理由同一个 Worker 提供，但本地开发时可以分离运行。注意环境变量 `VITE_EH_URL` 的配置。

## 许可证 / License

贡献的代码将采用项目的 [GPL-3.0](LICENSE.txt) 许可证。

## 行为准则 / Code of Conduct

- 尊重所有贡献者
- 保持讨论专业和建设性
- 接受建设性批评
- 关注对项目最有利的事情

## 需要帮助？ / Need Help?

如有疑问，可以：

- 查看现有 [Issues](https://github.com/JKRaks/EViewer/issues) 和 [Discussions](https://github.com/JKRaks/EViewer/discussions)
- 在 Issue 中提问
- 查阅项目文档

再次感谢你的贡献！🎉

Thank you for your contribution! 🎉
