# cc-design

AI 生成网站前的风格预览与选择系统。在 AI 开始写代码之前，先生成多种 UI 风格的可视化预览供用户选择，用户"看到"并"选择"后，AI 才按照选定的风格生成代码。

## 安装

```bash
npm install
npm run build
```

## 配置

将 cc-design 添加到你的 AI 编辑器的 MCP 配置中：

**Claude Code** (`.claude/mcp.json`):

```json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["/path/to/cc-design/dist/index.js"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["/path/to/cc-design/dist/index.js"]
    }
  }
}
```

将 `skill/SKILL.md` 复制到你的项目的技能目录中（如 `.claude/skills/` 或 `.cursor/skills/`）。

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

## 许可证

MIT
