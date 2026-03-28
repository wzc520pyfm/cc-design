import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

interface PlatformConfig {
  skillDir: string;
  mcpFile: string;
  globalSkillDir: string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  claude: {
    skillDir: '.claude/skills',
    mcpFile: '.claude/mcp.json',
    globalSkillDir: path.join(os.homedir(), '.claude', 'skills'),
  },
  cursor: {
    skillDir: '.cursor/skills',
    mcpFile: '.cursor/mcp.json',
    globalSkillDir: path.join(os.homedir(), '.cursor', 'skills'),
  },
  codex: {
    skillDir: '.agents/skills',
    mcpFile: '',
    globalSkillDir: path.join(os.homedir(), '.agents', 'skills'),
  },
  all: {
    skillDir: '',
    mcpFile: '',
    globalSkillDir: '',
  },
};

function copySkill(targetDir: string): void {
  const skillSource = path.join(PACKAGE_ROOT, 'skills', 'cc-design', 'SKILL.md');
  const skillTargetDir = path.join(targetDir, 'cc-design');
  fs.mkdirSync(skillTargetDir, { recursive: true });
  fs.copyFileSync(skillSource, path.join(skillTargetDir, 'SKILL.md'));
  console.log(`  ✓ Skill → ${skillTargetDir}`);
}

function configureMcp(mcpFile: string): void {
  if (!mcpFile) return;

  const mcpDir = path.dirname(mcpFile);
  fs.mkdirSync(mcpDir, { recursive: true });

  let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };

  if (fs.existsSync(mcpFile)) {
    try {
      config = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      config = { mcpServers: {} };
    }
  }

  if (config.mcpServers!['cc-design']) {
    console.log(`  ✓ MCP already configured in ${mcpFile}`);
    return;
  }

  config.mcpServers!['cc-design'] = {
    command: 'npx',
    args: ['-y', 'cc-design'],
  };

  fs.writeFileSync(mcpFile, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ✓ MCP → ${mcpFile}`);
}

function installForPlatform(platform: string, isGlobal: boolean): void {
  const cfg = PLATFORMS[platform];
  if (!cfg) return;

  const cwd = process.cwd();

  const skillDir = isGlobal
    ? cfg.globalSkillDir
    : path.join(cwd, cfg.skillDir);

  copySkill(skillDir);

  const mcpFile = isGlobal ? '' : (cfg.mcpFile ? path.join(cwd, cfg.mcpFile) : '');
  configureMcp(mcpFile);
}

export async function runInit(args: string[]): Promise<void> {
  let platform = '';
  let isGlobal = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ai' && args[i + 1]) {
      platform = args[i + 1];
      i++;
    }
    if (args[i] === '--global') {
      isGlobal = true;
    }
  }

  if (!platform || !PLATFORMS[platform]) {
    console.log('cc-design — AI style preview & selection\n');
    console.log('Usage:');
    console.log('  npx cc-design init --ai <platform> [--global]\n');
    console.log('Platforms:');
    console.log('  claude    Claude Code');
    console.log('  cursor    Cursor');
    console.log('  codex     Codex CLI');
    console.log('  all       All platforms\n');
    console.log('Options:');
    console.log('  --global  Install to home directory (available for all projects)');
    process.exit(1);
  }

  console.log(`\ncc-design — installing for ${platform}${isGlobal ? ' (global)' : ''}...\n`);

  if (platform === 'all') {
    for (const p of ['claude', 'cursor', 'codex']) {
      console.log(`[${p}]`);
      installForPlatform(p, isGlobal);
    }
  } else {
    installForPlatform(platform, isGlobal);
  }

  console.log('\n✓ Done! Start a new AI session and ask it to build a website.\n');
}
