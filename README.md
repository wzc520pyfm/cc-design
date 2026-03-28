# cc-design

AI 生成网站前的风格预览与选择系统。在 AI 开始写代码之前，先生成多种 UI 风格的可视化预览供用户选择，用户"看到"并"选择"后，AI 才按照选定的风格生成代码。

## 安装

### Claude Code 插件市场

```
/plugin marketplace add wzc520pyfm/cc-design
/plugin install cc-design@cc-design
```

### 使用 CLI

```bash
# 进入你的项目
cd /path/to/your/project

# 选择你的 AI 平台
npx cc-design-cli init --ai claude    # Claude Code
npx cc-design-cli init --ai cursor    # Cursor
npx cc-design-cli init --ai codex     # Codex CLI
npx cc-design-cli init --ai all       # 所有平台
```

### 全局安装（对所有项目生效）

```bash
npx cc-design-cli init --ai claude --global
npx cc-design-cli init --ai cursor --global
```

### 验证安装

启动新会话，对 AI 说"帮我做一个美食博客网站"。如果 cc-design 正确加载，AI 会自动触发风格预览流程，而不是直接生成代码。

## 工作原理

1. 用户告诉 AI "帮我做一个美食博客网站"
2. SKILL 拦截请求，引导 AI 生成 3-4 种不同风格的 HTML/CSS 预览
3. MCP Server 启动本地 HTTP 服务器，在浏览器中展示风格画廊
4. 用户浏览、全屏预览、选择喜欢的风格（或要求再生成一批）
5. AI 收到选择结果，按照选定的设计系统规范生成完整项目代码

## MCP 工具

| 工具 | 说明 |
|------|------|
| `create_style_preview` | 提交风格预览 HTML，启动画廊展示 |
| `get_user_selection` | 获取用户的选择结果 |
| `stop_preview` | 关闭预览服务器 |

## CLI 命令

```bash
npx cc-design-cli init --ai <platform> [--global]   # 安装
```

| 平台 | 说明 |
|------|------|
| `claude` | Claude Code |
| `cursor` | Cursor |
| `codex` | Codex CLI |
| `all` | 所有平台 |

## 更新

```bash
npx cc-design-cli@latest init --ai <platform>
```

## 许可证

MIT
