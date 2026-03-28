# Installing cc-design for Codex

Enable cc-design skills in Codex via native skill discovery.

## Prerequisites

- Git
- Node.js >= 18

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/wzc520pyfm/cc-design.git ~/.codex/cc-design
   ```

2. **Build the MCP server:**
   ```bash
   cd ~/.codex/cc-design
   npm install && npm run build
   ```

3. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/cc-design/skills ~/.agents/skills/cc-design
   ```

4. **Configure MCP server** in your project's MCP config:
   ```json
   {
     "mcpServers": {
       "cc-design": {
         "command": "node",
         "args": ["~/.codex/cc-design/dist/index.js"]
       }
     }
   }
   ```

5. **Restart Codex** to discover the skills.

## Verify

```bash
ls -la ~/.agents/skills/cc-design
```

You should see a symlink pointing to your cc-design skills directory.

## Updating

```bash
cd ~/.codex/cc-design && git pull && npm run build
```

Skills update instantly through the symlink. The MCP server is rebuilt to pick up changes.

## Uninstalling

```bash
rm ~/.agents/skills/cc-design
```

Optionally delete the clone: `rm -rf ~/.codex/cc-design`.
