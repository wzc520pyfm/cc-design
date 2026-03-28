# cc-design

AI 生成网站前的风格预览与选择系统。在 AI 开始写代码之前，先生成多种 UI 风格的可视化预览供用户选择，用户"看到"并"选择"后，AI 才按照选定的风格生成代码。

## 安装

### Claude Code

先注册自托管 marketplace，再安装插件：

```
/plugin marketplace add wzc520pyfm/cc-design
/plugin install cc-design@cc-design
```

安装后，在项目的 `.claude/mcp.json` 中配置 MCP Server（session-start hook 会输出完整路径）：

```json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["<plugin-path>/dist/index.js"]
    }
  }
}
```

### Claude Code（手动安装）

```bash
git clone https://github.com/wzc520pyfm/cc-design.git ~/.claude/plugins/cc-design
cd ~/.claude/plugins/cc-design
npm install && npm run build
```

然后在项目的 `.claude/mcp.json` 中配置 MCP Server：

```json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["~/.claude/plugins/cc-design/dist/index.js"]
    }
  }
}
```

将 skill 软链接到技能目录：

```bash
mkdir -p ~/.agents/skills
ln -s ~/.claude/plugins/cc-design/skills ~/.agents/skills/cc-design
```

### Cursor

在 Cursor Agent 聊天中安装：

```
/add-plugin cc-design
```

或搜索 "cc-design"。

安装后，在项目的 `.cursor/mcp.json` 中配置 MCP Server：

```json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["<plugin-path>/dist/index.js"]
    }
  }
}
```

`<plugin-path>` 是插件安装的实际路径（session-start hook 输出中会提示）。

### Codex

告诉 Codex：

```
Fetch and follow instructions from https://raw.githubusercontent.com/wzc520pyfm/cc-design/main/.codex/INSTALL.md
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

## 项目结构

```
cc-design/
├── .claude-plugin/       # Claude Code 插件配置
├── .cursor-plugin/       # Cursor 插件配置
├── .codex/               # Codex 安装指南
├── hooks/                # 会话启动钩子（自动构建 MCP Server）
├── skills/cc-design/     # AI 技能定义
│   └── SKILL.md
├── src/                  # MCP Server 源码
│   ├── index.ts          # MCP Server 入口
│   ├── tools/            # MCP 工具处理器
│   ├── http/             # HTTP 预览服务器
│   ├── session/          # 会话管理
│   ├── client/           # 画廊前端
│   └── data/             # 内置风格家族数据
└── tests/                # 测试
```

## 更新

插件市场安装：

```
/plugin update cc-design
```

手动安装：

```bash
cd ~/.claude/plugins/cc-design && git pull && npm run build
```

## 许可证

MIT
