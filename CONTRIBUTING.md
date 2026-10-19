# Contributing Guide

## 开发流程

### 1. Fork 与克隆

```bash
git clone https://github.com/your-username/EViewer.git
cd EViewer
git remote add upstream https://github.com/JKRaks/EViewer.git
```

### 2. 创建分支

从 `pre` 创建功能分支：

```bash
git checkout pre
git pull upstream pre
git checkout -b feature/your-feature-name
```

分支命名：

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档
- `refactor/` - 重构
- `perf/` - 性能优化

### 3. 本地开发

```bash
npm ci
npm run dev              # Vite 开发服务器
npm run dev:worker       # 本地 Worker
```

`dev:worker` 需先运行 `npm run build`。热更新开发可另启动 Vite 并将 `VITE_EH_URL` 指向 Worker 地址。

### 4. 代码规范

提交前确保：

```bash
npm run lint            # ESLint 修复
npm run format          # Prettier 格式化
npm run type-check      # TypeScript 检查
npm run check:worker    # Worker 检查
npm run build           # 构建成功
```

代码风格：

- 遵循项目现有风格和命名
- TypeScript 类型标注完整
- 组件和函数职责单一
- 复杂逻辑添加注释

### 5. 提交信息

格式：

```
<type>(<scope>): <subject>

<body>
```

Type：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建或工具

示例：

```
feat(viewer): add zoom controls

Add zoom in/out buttons and keyboard shortcuts (+ / -).
Resolves #123
```

### 6. 提交 Pull Request

```bash
git push origin feature/your-feature-name
```

**PR 提交到 `pre` 分支，不是 `main`。**

创建 PR 时：

1. 目标分支选择 `pre`
2. 标题清晰简要
3. 描述包含：
   - 改动目的和背景
   - 主要变更内容
   - 测试方法
   - 相关 Issue 编号
4. UI 改动附截图或录屏
5. 检查 CI 状态

分支策略：

- 功能分支 → `pre`：所有改动先合并到预发环境
- `pre` → `main`：经预发环境测试后，由维护者合并到生产分支

### 7. 代码审查

维护者审查代码并可能提出修改建议。请：

- 及时回应反馈
- 根据建议修改
- 保持讨论友好和专业

## 报告问题

发现 Bug 或功能建议请在 [Issues](https://github.com/JKRaks/EViewer/issues) 提交。

Bug 报告应包含：

- 问题描述
- 复现步骤
- 预期行为与实际行为
- 环境信息（浏览器版本、操作系统）
- 截图或错误日志

功能建议应包含：

- 功能描述
- 使用场景
- 预期效果
- 实现思路（可选）

## 开发注意事项

### 认证测试

本地开发需要配置代理认证信息。**不要将真实 Cookie 提交到仓库**。

### Cloudflare Workers 部署

双环境部署策略：

- 功能分支 PR：只触发构建验证，不部署
- 合并到 `pre`：自动部署到 Preview 环境
- 合并到 `main`：由维护者操作，部署到生产环境

开发者应：

1. 提交 PR 到 `pre`
2. 确保 CI 验证通过
3. 等待代码审查
4. PR 合并后在 Preview 环境测试
5. 后续由维护者将 `pre` 合并到 `main`

### 前端代理分离

生产环境前端与代理由同一 Worker 提供，本地开发可分离运行。注意 `VITE_EH_URL` 配置。

## 许可证

贡献代码采用项目的 [GPL-3.0](LICENSE.txt) 许可证。

## 行为准则

- 尊重所有贡献者
- 保持讨论专业和建设性
- 接受建设性批评
- 关注对项目最有利的事情

## 需要帮助

有疑问可以：

- 查看 [Issues](https://github.com/JKRaks/EViewer/issues) 和 [Discussions](https://github.com/JKRaks/EViewer/discussions)
- 在 Issue 中提问
- 查阅项目文档
