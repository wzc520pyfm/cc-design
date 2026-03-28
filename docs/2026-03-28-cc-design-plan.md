# cc-design Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code / Cursor plugin that provides visual UI style previews before AI generates website code, using a SKILL + MCP Server hybrid architecture.

**Architecture:** SKILL.md intercepts web creation requests and guides AI to generate multiple HTML/CSS style previews. MCP Server (Node.js/TypeScript) hosts previews on a local HTTP server, presents a gallery UI for selection, and returns the user's choice back to AI via MCP tools. Selected style persists as a design system JSON for code generation.

**Tech Stack:** Node.js, TypeScript, `@modelcontextprotocol/sdk`, native `http` module (zero external HTTP framework dependencies), HTML/CSS/JS for gallery frontend.

**Spec:** `docs/2026-03-28-cc-design-spec.md`

---

## File Structure

```
cc-design/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
│
├── src/
│   ├── index.ts                     # MCP Server entry point
│   │
│   ├── tools/                       # MCP tool handlers
│   │   ├── create-preview.ts        # create_style_preview tool
│   │   ├── get-selection.ts         # get_user_selection tool
│   │   └── stop-preview.ts          # stop_preview tool
│   │
│   ├── http/                        # HTTP preview server
│   │   └── server.ts                # HTTP server: serves gallery, handles API routes
│   │
│   ├── session/                     # Session data management
│   │   └── manager.ts               # Create/read/write session data
│   │
│   ├── client/                      # Gallery frontend (served as static files)
│   │   ├── gallery.html             # Gallery page template
│   │   ├── gallery.css              # Gallery styles (dark theme)
│   │   └── gallery.js               # Gallery interaction logic
│   │
│   └── data/                        # Built-in data
│       └── style-families.json      # 67 style families for regeneration picker
│
├── skill/
│   └── SKILL.md                     # AI skill definition
│
├── tests/
│   ├── session-manager.test.ts      # Session manager unit tests
│   └── tools.test.ts                # MCP tool handler unit tests
│
└── docs/
    ├── 2026-03-28-cc-design-spec.md
    └── 2026-03-28-cc-design-plan.md  # This file
```

**Design decisions:**
- No Express/Koa — use Node.js native `http` module to keep dependencies minimal. The HTTP API has only 4 routes; a framework is overkill.
- Session data stored in OS temp directory (`os.tmpdir()/cc-design-sessions/`) — no project pollution, auto-cleaned by OS.
- Gallery frontend uses vanilla HTML/CSS/JS — no build step, served as static files.
- `@modelcontextprotocol/sdk` is the only runtime dependency beyond Node.js built-ins.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/wangzhichao/办公/code/github/cc-design
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "cc-design",
  "version": "0.1.0",
  "description": "AI style preview and selection before code generation",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "cc-design": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "keywords": ["mcp", "design", "ui", "style", "preview", "claude", "cursor"],
  "license": "MIT"
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.js.map
.DS_Store
mockup-gallery.html
```

- [ ] **Step 5: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk
npm install -D typescript vitest @types/node
```

- [ ] **Step 6: Create README.md**

Write a concise README with: what cc-design does (1 paragraph), installation instructions (npm install + MCP config), and a usage example.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize project with TypeScript and MCP SDK"
```

---

## Task 2: Session Manager

Manages session lifecycle: create sessions, store style data, record user events, clean up.

**Files:**
- Create: `src/session/manager.ts`
- Create: `tests/session-manager.test.ts`

- [ ] **Step 1: Write failing tests for SessionManager**

Create `tests/session-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../src/session/manager.js';
import fs from 'fs';
import path from 'path';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  afterEach(() => {
    // clean up any created sessions
  });

  it('creates a session with unique ID', () => {
    const session = manager.createSession('美食博客');
    expect(session.id).toBeTruthy();
    expect(session.appDescription).toBe('美食博客');
    expect(session.rounds).toEqual([]);
  });

  it('adds a round of styles to a session', () => {
    const session = manager.createSession('美食博客');
    const styles = [
      {
        id: 'style-1',
        name: 'Warm Organic',
        description: 'Warm tones',
        preview_html: '<div>preview</div>',
        design_system: {
          colors: { primary: '#C67C4E', secondary: '#8B6914', accent: '#E8956A', background: '#FFF8F0', text: '#3D2B1F' },
          typography: { heading_font: 'Playfair Display', body_font: 'Inter', google_fonts_url: '' },
          border_radius: '16px', shadow_style: 'soft', layout_pattern: 'Hero + Cards',
          effects: 'Soft shadows', anti_patterns: ['No neon']
        }
      }
    ];
    manager.addRound(session.id, 1, styles);
    const updated = manager.getSession(session.id);
    expect(updated!.rounds).toHaveLength(1);
    expect(updated!.rounds[0].styles).toHaveLength(1);
  });

  it('records a selection event', () => {
    const session = manager.createSession('test');
    manager.recordEvent(session.id, { type: 'select', styleId: 'style-1' });
    const events = manager.getEvents(session.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('select');
  });

  it('records a regenerate event with base_style and feedback', () => {
    const session = manager.createSession('test');
    manager.recordEvent(session.id, {
      type: 'regenerate',
      base_style: 'Glassmorphism',
      feedback: 'warmer colors'
    });
    const events = manager.getEvents(session.id);
    expect(events[0].type).toBe('regenerate');
    expect(events[0].base_style).toBe('Glassmorphism');
  });

  it('finds a style by ID across rounds', () => {
    const session = manager.createSession('test');
    const style = {
      id: 'style-1', name: 'Test', description: 'desc',
      preview_html: '<div>test</div>',
      design_system: {
        colors: { primary: '#000', secondary: '#111', accent: '#222', background: '#fff', text: '#000' },
        typography: { heading_font: 'Inter', body_font: 'Inter', google_fonts_url: '' },
        border_radius: '8px', shadow_style: 'none', layout_pattern: 'Grid',
        effects: '', anti_patterns: []
      }
    };
    manager.addRound(session.id, 1, [style]);
    const found = manager.findStyle(session.id, 'style-1');
    expect(found).toBeTruthy();
    expect(found!.name).toBe('Test');
  });

  it('destroys a session and cleans up files', () => {
    const session = manager.createSession('test');
    manager.destroySession(session.id);
    expect(manager.getSession(session.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/session-manager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SessionManager**

Create `src/session/manager.ts`:

The SessionManager class needs:
- `createSession(appDescription: string): Session` — creates session dir in tmpdir, returns `{ id, appDescription, rounds: [] }`
- `getSession(id: string): Session | null` — reads meta.json from session dir
- `addRound(sessionId, roundNumber, styles, roundLabel?)` — appends round to session, writes each style's preview_html to `round-N/style-id.html`
- `getEvents(sessionId): Event[]` — reads events.json
- `recordEvent(sessionId, event)` — appends event to events.json
- `findStyle(sessionId, styleId): Style | null` — searches all rounds for a style by ID
- `getAllStyles(sessionId): { round, roundLabel, styles }[]` — returns all rounds with their styles (for gallery rendering)
- `getPreviewHtmlPath(sessionId, roundNumber, styleId): string` — returns file path for a preview HTML
- `destroySession(sessionId)` — removes session dir

TypeScript types:

```typescript
export interface DesignSystem {
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  typography: { heading_font: string; body_font: string; google_fonts_url: string };
  border_radius: string;
  shadow_style: string;
  layout_pattern: string;
  effects: string;
  anti_patterns: string[];
}

export interface StyleDefinition {
  id: string;
  name: string;
  description: string;
  preview_html: string;
  design_system: DesignSystem;
}

export interface Round {
  number: number;
  label?: string;
  styles: StyleDefinition[];
}

export interface Session {
  id: string;
  appDescription: string;
  rounds: Round[];
  createdAt: string;
}

export interface SessionEvent {
  type: 'select' | 'regenerate';
  styleId?: string;
  base_style?: string;
  feedback?: string;
  timestamp?: string;
}
```

Storage: all data in `os.tmpdir()/cc-design-sessions/{session-id}/`. Use `crypto.randomUUID()` for IDs. Write `meta.json` for session metadata, `events.json` for events, and `round-{N}/{style-id}.html` for preview files.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/session-manager.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/ tests/session-manager.test.ts
git commit -m "feat: add session manager for style preview lifecycle"
```

---

## Task 3: HTTP Preview Server

Serves the gallery page and handles API routes for selection/regeneration.

**Files:**
- Create: `src/http/server.ts`

- [ ] **Step 1: Implement PreviewServer class**

Create `src/http/server.ts`:

The PreviewServer class needs:
- `constructor(sessionManager: SessionManager)`
- `start(sessionId: string): Promise<{ port: number; url: string }>` — starts HTTP server on a random available port
- `stop(): Promise<void>` — closes the HTTP server
- `isRunning(): boolean`

Routes to handle (using Node.js `http.createServer`):
- `GET /` — Serve gallery page. Read all rounds/styles from SessionManager, inject data into gallery.html template, return complete page.
- `GET /preview/:sessionId/:roundNumber/:styleId` — Return the raw preview HTML for a single style (used as iframe src).
- `POST /api/select` — Parse JSON body `{ styleId }`, call `sessionManager.recordEvent(sessionId, { type: 'select', styleId })`, return `{ ok: true }`.
- `POST /api/regenerate` — Parse JSON body `{ base_style?, feedback? }`, call `sessionManager.recordEvent(sessionId, { type: 'regenerate', ... })`, return `{ ok: true }`.
- `GET /styles-data` — Return JSON of all rounds with styles (minus preview_html for efficiency). Used by gallery.js for dynamic rendering.
- Static files: `GET /gallery.css`, `GET /gallery.js`, `GET /style-families.json` — serve from `src/client/` directory.

Port selection: try a port in the 52680-52780 range, incrementing if busy.

CORS: add `Access-Control-Allow-Origin: *` for local development.

URL parsing: use `new URL(req.url, 'http://localhost')` for route matching + query params.

- [ ] **Step 2: Run build to verify compilation**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/http/
git commit -m "feat: add HTTP preview server with gallery and API routes"
```

---

## Task 4: Gallery Frontend

The browser-facing UI where users see style previews and make selections.

**Files:**
- Create: `src/client/gallery.html`
- Create: `src/client/gallery.css`
- Create: `src/client/gallery.js`

- [ ] **Step 1: Create gallery.html**

The HTML file is a template. The HTTP server injects `APP_DESCRIPTION` and `SESSION_ID` as JS variables when serving. Structure:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cc-design · 风格预览</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/gallery.css">
</head>
<body>
  <header class="header">
    <!-- cc-design logo, app description, style count, "再来一批" button -->
  </header>
  <main class="main" id="gallery">
    <h1>选择你喜欢的风格</h1>
    <p class="subtitle"><!-- dynamic --></p>
    <div id="rounds-container">
      <!-- Rounds and style cards rendered by gallery.js -->
    </div>
  </main>
  <div class="bottom-bar" id="bottomBar">
    <!-- Selection confirmation bar -->
  </div>
  <div class="fullscreen-overlay" id="fullscreenOverlay">
    <!-- Fullscreen preview overlay -->
  </div>
  <div class="feedback-modal" id="feedbackModal">
    <!-- Regenerate modal with style family picker + text feedback -->
  </div>
  <script>
    window.__CC_DESIGN__ = {
      sessionId: "{{SESSION_ID}}",
      appDescription: "{{APP_DESCRIPTION}}"
    };
  </script>
  <script src="/gallery.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create gallery.css**

Dark-themed gallery styles. Reference the mockup in `mockup-gallery.html` for the visual design. Key sections:
- Header (sticky, blurred background)
- Style cards (2-column grid, border highlight on select, hover effects)
- Select indicator (checkmark badge, animated)
- Preview iframe container (fixed height, pointer-events: none)
- Bottom confirmation bar (slide up animation)
- Fullscreen overlay
- Feedback modal with style family picker
- Round dividers with labels
- Color dots
- Style tags
- Toast notifications
- Responsive adjustments for smaller screens

- [ ] **Step 3: Create gallery.js**

Vanilla JS that:
1. On load: `fetch('/styles-data')` to get all rounds/styles data
2. Renders rounds (newest first) with style cards containing `<iframe>` previews
3. `selectStyle(styleId)` — highlights card, shows bottom bar, tracks selection
4. `openFullscreen(styleId)` — opens fullscreen overlay with iframe
5. `closeFullscreen()` — closes overlay
6. `confirmSelection()` — `POST /api/select` with selected styleId, shows toast
7. `showRegenerateModal()` — opens modal with style family list + textarea
8. `submitRegenerate()` — `POST /api/regenerate` with base_style + feedback, shows toast
9. Style family list: fetched from `/style-families.json`
10. Polling: after confirming selection or regeneration, poll until the page refreshes (server pushes new round or signals completion)

The iframe src for each style preview: `/preview/{{sessionId}}/{{roundNumber}}/{{styleId}}`

- [ ] **Step 4: Verify gallery renders correctly**

Temporarily hard-code test data in `server.ts`, start the server, and open in browser to verify:
- Gallery page loads with dark theme
- Style cards display with iframe previews
- Click to select works
- Fullscreen preview works
- Regenerate modal opens

```bash
npm run build && node dist/index.js
# Open http://localhost:52680 in browser
```

- [ ] **Step 5: Commit**

```bash
git add src/client/
git commit -m "feat: add gallery frontend with style preview and selection UI"
```

---

## Task 5: Style Families Data

Built-in style family list for the regeneration picker.

**Files:**
- Create: `src/data/style-families.json`

- [ ] **Step 1: Create style-families.json**

JSON array of 67 style families. Each entry:

```json
{
  "id": "glassmorphism",
  "name": "Glassmorphism",
  "name_zh": "玻璃拟态",
  "description": "半透明毛玻璃质感，现代感十足",
  "keywords": ["半透明", "毛玻璃", "模糊背景", "现代"],
  "best_for": ["SaaS", "金融仪表盘", "现代应用"],
  "avoid_for": ["老年用户", "低端设备"],
  "category": "modern"
}
```

Categories for grouping in the picker: `modern`, `classic`, `bold`, `immersive`, `functional`, `creative`.

Populate with styles from the spec §5.4 table plus additional entries from ui-ux-pro-max's 67 styles. Include at minimum:
Minimalism, Glassmorphism, Neumorphism, Brutalism, Bento Grid, Editorial, Dark Immersive, Organic, Retro-Futurism, Flat Design, Aurora UI, Claymorphism, Y2K Aesthetic, Cyberpunk, Swiss Modernism, Neubrutalism, Vaporwave, Memphis Design, Pixel Art, Spatial UI, E-Ink/Paper, Kinetic Typography, Parallax Storytelling, 3D Hyperrealism, Motion-Driven, Soft UI Evolution, Dimensional Layering, Exaggerated Minimalism, Interactive Cursor, Gradient Mesh, Chromatic Aberration, Vintage Analog, AI-Native UI, HUD/Sci-Fi, Accessible Design, Liquid Glass, Skeuomorphism, Micro-interactions, Zero Interface, Tactile Digital, Nature Distilled, Anti-Polish, Gen Z Maximalism, Biomimetic, Voice-First Multimodal, 3D Product Preview.

- [ ] **Step 2: Commit**

```bash
git add src/data/
git commit -m "feat: add 67 built-in style families for regeneration picker"
```

---

## Task 6: MCP Tool Handlers

The three MCP tools that AI calls.

**Files:**
- Create: `src/tools/create-preview.ts`
- Create: `src/tools/get-selection.ts`
- Create: `src/tools/stop-preview.ts`
- Create: `tests/tools.test.ts`

- [ ] **Step 1: Write failing tests for tool handlers**

Create `tests/tools.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { handleCreatePreview } from '../src/tools/create-preview.js';
import { handleGetSelection } from '../src/tools/get-selection.js';
import { handleStopPreview } from '../src/tools/stop-preview.js';
import { SessionManager } from '../src/session/manager.js';

describe('create_style_preview handler', () => {
  it('creates a new session and returns preview URL', async () => {
    const manager = new SessionManager();
    const result = await handleCreatePreview(manager, {
      app_description: '美食博客',
      round: 1,
      styles: [{
        id: 'style-1', name: 'Test', description: 'test',
        preview_html: '<div>test</div>',
        design_system: { /* minimal valid design system */ }
      }]
    });
    expect(result.session_id).toBeTruthy();
    expect(result.preview_url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(result.total_styles).toBe(1);
    // cleanup
    await handleStopPreview(manager, { session_id: result.session_id });
  });

  it('appends styles to existing session', async () => {
    const manager = new SessionManager();
    const r1 = await handleCreatePreview(manager, {
      app_description: '美食博客', round: 1,
      styles: [{ id: 's1', name: 'A', description: '', preview_html: '<div></div>', design_system: {} }]
    });
    const r2 = await handleCreatePreview(manager, {
      session_id: r1.session_id,
      app_description: '美食博客', round: 2, round_label: '基于 Glassmorphism',
      styles: [{ id: 's2', name: 'B', description: '', preview_html: '<div></div>', design_system: {} }]
    });
    expect(r2.total_styles).toBe(2);
    await handleStopPreview(manager, { session_id: r1.session_id });
  });
});

describe('get_user_selection handler', () => {
  it('returns pending when no events exist', async () => {
    const manager = new SessionManager();
    const session = manager.createSession('test');
    const result = await handleGetSelection(manager, { session_id: session.id });
    expect(result.status).toBe('pending');
    manager.destroySession(session.id);
  });

  it('returns selected with design_system when user selects', async () => {
    const manager = new SessionManager();
    const session = manager.createSession('test');
    const style = {
      id: 'style-1', name: 'Warm', description: '',
      preview_html: '<div></div>',
      design_system: { colors: { primary: '#C67C4E' } }
    };
    manager.addRound(session.id, 1, [style]);
    manager.recordEvent(session.id, { type: 'select', styleId: 'style-1' });
    const result = await handleGetSelection(manager, { session_id: session.id });
    expect(result.status).toBe('selected');
    expect(result.selected_style.id).toBe('style-1');
    expect(result.selected_style.design_system.colors.primary).toBe('#C67C4E');
    manager.destroySession(session.id);
  });

  it('returns regenerate with base_style and feedback', async () => {
    const manager = new SessionManager();
    const session = manager.createSession('test');
    manager.recordEvent(session.id, {
      type: 'regenerate', base_style: 'Glassmorphism', feedback: 'warmer'
    });
    const result = await handleGetSelection(manager, { session_id: session.id });
    expect(result.status).toBe('regenerate');
    expect(result.base_style).toBe('Glassmorphism');
    expect(result.feedback).toBe('warmer');
    manager.destroySession(session.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/tools.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement create-preview handler**

Create `src/tools/create-preview.ts`:

```typescript
export async function handleCreatePreview(
  sessionManager: SessionManager,
  previewServer: PreviewServer,
  params: CreatePreviewParams
): Promise<CreatePreviewResult>
```

Logic:
1. If `params.session_id` exists, reuse session; else create new session via `sessionManager.createSession(params.app_description)`
2. Call `sessionManager.addRound(sessionId, params.round, params.styles, params.round_label)`
3. If preview server not running for this session, start it: `previewServer.start(sessionId)`
4. Count total styles across all rounds
5. Return `{ session_id, preview_url, total_styles }`

- [ ] **Step 4: Implement get-selection handler**

Create `src/tools/get-selection.ts`:

```typescript
export async function handleGetSelection(
  sessionManager: SessionManager,
  params: { session_id: string }
): Promise<GetSelectionResult>
```

Logic:
1. Get events via `sessionManager.getEvents(params.session_id)`
2. If no events → return `{ status: 'pending' }`
3. Find the last event (most recent)
4. If last event is `select` → find the style via `sessionManager.findStyle()`, return `{ status: 'selected', selected_style: { id, name, design_system } }`
5. If last event is `regenerate` → return `{ status: 'regenerate', base_style, feedback, keep_previous: true }`

- [ ] **Step 5: Implement stop-preview handler**

Create `src/tools/stop-preview.ts`:

```typescript
export async function handleStopPreview(
  previewServer: PreviewServer,
  sessionManager: SessionManager,
  params: { session_id: string }
): Promise<{ status: string }>
```

Logic:
1. Stop preview server: `previewServer.stop()`
2. Destroy session: `sessionManager.destroySession(params.session_id)`
3. Return `{ status: 'stopped' }`

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/tools.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/tools/ tests/tools.test.ts
git commit -m "feat: implement MCP tool handlers for preview lifecycle"
```

---

## Task 7: MCP Server Entry Point

Wires MCP protocol, tool handlers, session manager, and HTTP server together.

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement MCP Server entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';  // bundled with MCP SDK
```

Set up:
1. Create `SessionManager` instance
2. Create `PreviewServer` instance (not started yet — started on first `create_style_preview` call)
3. Create `McpServer` with name "cc-design" and version from package.json
4. Register 3 tools with input schemas (using Zod for validation):

**`create_style_preview`** — input schema matches spec §4.1:
```typescript
server.tool('create_style_preview', {
  description: 'Generate and serve UI style previews for user selection',
  // Zod schema for params
}, async (params) => {
  const result = await handleCreatePreview(sessionManager, previewServer, params);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

**`get_user_selection`** — input: `{ session_id: string }`

**`stop_preview`** — input: `{ session_id: string }`

5. Connect via `StdioServerTransport`
6. Add `#!/usr/bin/env node` shebang for CLI execution

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: compiles without errors, `dist/index.js` created.

- [ ] **Step 3: Test MCP server starts**

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}' | node dist/index.js
```

Expected: JSON response with server capabilities and 3 tools listed.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up MCP server with tool registration and stdio transport"
```

---

## Task 8: SKILL.md

The AI skill definition that orchestrates the entire cc-design flow.

**Files:**
- Create: `skill/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Content from spec §5, structured as a skill file:

```markdown
---
name: cc-design
description: "Activate when user requests creating a website or web application. Provides visual UI style preview and selection before code generation."
---

# cc-design: UI Style Preview & Selection

[Full content from spec §5.1 through §5.4, formatted as actionable instructions for AI]
```

Key sections:
1. **When to activate** — trigger conditions (create web app, build website, etc.)
2. **When NOT to activate** — skip conditions (modify existing, backend only, user opts out)
3. **Workflow** — Step 1-7 with exact MCP tool calls
4. **Style Generation Rules** — the complete prompt for generating preview HTML + design_system JSON
5. **Style Knowledge Base** — style families table + industry reasoning rules (from spec)
6. **After Selection** — persist design system, generate code, checklist

- [ ] **Step 2: Commit**

```bash
git add skill/
git commit -m "feat: add SKILL.md with style preview workflow and knowledge base"
```

---

## Task 9: Integration Test

End-to-end verification that the full flow works.

**Files:** (no new files — manual testing)

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 2: Run all unit tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Manual integration test**

1. Start MCP server: `node dist/index.js`
2. Send `create_style_preview` with test data (2 styles with real HTML)
3. Open the returned URL in browser
4. Verify: gallery renders, cards show previews, click to select works, fullscreen works
5. Click "确认选择" and verify `get_user_selection` returns `{ status: "selected", ... }`
6. Test regeneration: click "都不喜欢", select a style family, submit
7. Verify `get_user_selection` returns `{ status: "regenerate", base_style: "...", ... }`
8. Send another `create_style_preview` with round=2 to same session
9. Verify gallery shows both rounds with newest on top
10. Call `stop_preview` and verify server shuts down

- [ ] **Step 4: Add MCP configuration example to README**

Add to README.md how to configure cc-design in Claude Code and Cursor:

```json
// Claude Code: .claude/mcp.json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["/path/to/cc-design/dist/index.js"]
    }
  }
}

// Cursor: .cursor/mcp.json
{
  "mcpServers": {
    "cc-design": {
      "command": "node",
      "args": ["/path/to/cc-design/dist/index.js"]
    }
  }
}
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "docs: add MCP configuration examples and finalize README"
```

---

## Summary

| Task | Description | Key Files | Est. Steps |
|------|-------------|-----------|-----------|
| 1 | Project Scaffolding | package.json, tsconfig.json | 7 |
| 2 | Session Manager | src/session/manager.ts | 5 |
| 3 | HTTP Preview Server | src/http/server.ts | 3 |
| 4 | Gallery Frontend | src/client/gallery.{html,css,js} | 5 |
| 5 | Style Families Data | src/data/style-families.json | 2 |
| 6 | MCP Tool Handlers | src/tools/*.ts | 7 |
| 7 | MCP Server Entry | src/index.ts | 4 |
| 8 | SKILL.md | skill/SKILL.md | 2 |
| 9 | Integration Test | — | 5 |
| **Total** | | | **40 steps** |
