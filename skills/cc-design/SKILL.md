---
name: cc-design
description: "Activate when user requests creating a website or web application. Provides visual UI style preview and selection before code generation."
---

# cc-design: Style Preview Before Code Generation

When a user asks you to create a website, web application, landing page, or dashboard, use this skill to let them preview and choose a UI style before you generate code.

## Core Role

cc-design is a **preview and selection protocol**, not a design intelligence authority.

It solves one problem: **users should see and choose a UI style before AI generates code.**

For design knowledge — which styles suit which industry, what colors and fonts to pair, what anti-patterns to avoid — cc-design relies on **you (the agent)** to bring the best knowledge available. You may have design intelligence skills (like ui-ux-pro-max or others), plugins, user-provided rules, or your own training knowledge. Use whatever produces the best recommendations, then feed the results into cc-design's preview workflow.

## When to Activate

Activate when the user's request involves **creating a new web project from scratch**:
- "帮我做一个..." / "Build a..." / "Create a..." + website/web app/landing page/dashboard
- "做一个美食博客" / "Build a SaaS dashboard" / "Create an e-commerce site"

## When NOT to Activate

- Modifying an existing project ("加个按钮", "fix the header")
- Pure backend/API work
- User explicitly opts out ("不需要选风格", "直接生成", "skip style selection")

## Cost, Speed, and Token Use

Steps **3–5** (several full inline HTML previews + MCP round-trips) are **high-token and often slow**. The skill still defaults to full previews when that is what the user wants—but you should make the tradeoff **visible and optional**, not silent.

### Cost-aware checkpoint (before Step 3)

**When:** After Step 2 (design intelligence gathered), **before** you generate 3–4 `preview_html` documents.

**Unless** the user has already clearly chosen a path in the same conversation (e.g. 「就要预览对比」「直接生成不要预览」), send a **short** message (a few sentences, not a wall of text) that:

1. **Full style preview** — Continue with Step 3–5 as usual (gallery + selection).
2. **Skip previews** — If they prefer: you synthesize **one** `design_system` from Step 2 only, write `.cc-design/design-system.json` (Step 6), then Step 7 **without** calling `create_style_preview`, `get_user_selection`, or `stop_preview` (no session).
3. **Cheaper / faster model** — They can **switch to a lower-cost or faster model** in their client for this thread (especially before Step 3), then continue. Wording should be client-agnostic (e.g. “在你用的 IDE / 对话里换一个更省 token 或更快的模型”); do not invent vendor pricing.

**Keep it smart, not noisy:**

| Situation | What to do |
|-----------|------------|
| User already asked for multiple styles / side‑by‑side / gallery | One line: previews are token-heavy; proceed unless they change their mind. |
| User gave a **detailed** visual spec (colors, fonts, layout) | Briefly note that **skipping previews** may save tokens while still matching their spec—ask if they want that. |
| User said skip / direct build / 不要预览 | **No** checkpoint; go to skip path (single `design_system` → Step 6 → Step 7). |
| **Regenerate** (round ≥ 2) before another Step 3 | Remind that **each round** repeats similar cost; encourage precise feedback to avoid extra rounds. |

If the user chooses **skip previews**, you still follow Step 6’s JSON shape; omit gallery-only fields from tool calls since no MCP session is created.

## Workflow

### Step 1: Analyze Requirements

Extract from the user's description:
- **app_type**: blog, e-commerce, SaaS, dashboard, portfolio, landing page, etc.
- **target_audience**: who will use this
- **features**: key functional modules (e.g., "article list, recipe detail, category navigation")
- **preference**: any style preference the user mentioned

### Step 2: Gather Design Intelligence

Before generating previews, gather the best design recommendations available to you.

**You (the agent) are the orchestrator.** Consider all your knowledge sources:

1. **Other design skills/plugins** — If you have access to any design intelligence skill or plugin (e.g., one that recommends styles, color palettes, typography, layout patterns for specific industries), use it. You don't need to know its name in advance — you already know what skills and tools are loaded in your session.
2. **User-provided rules** — The user may have project-level design guidelines, brand books, or explicit preferences.
3. **Your own knowledge** — Your training data includes substantial design knowledge. Use it.
4. **cc-design's fallback rules** — If none of the above are available or sufficient, refer to the Basic Style Reference at the end of this file.

**Your job:** Synthesize recommendations from the best available sources into cc-design's `design_system` format (defined below). No matter where the knowledge comes from, the output format is always the same.

### Step 3: Generate Style Variants

Generate 3-4 distinct UI style variants based on the design intelligence gathered in Step 2.

For each variant, produce:

1. **A complete HTML/CSS preview page** — a realistic preview of the user's actual application in that style
2. **A design_system JSON** — structured style definition for later code generation

**Preview generation rules:**

- Each variant MUST be visually distinct: different color palettes, typography, layout structure, visual effects
- Preview content must be based on the user's actual application (a food blog shows food blog content, not generic placeholders)
- Use real Chinese/English content, never Lorem ipsum
- Each preview must include at minimum: navigation bar, hero section, main content area
- All HTML and CSS must be inline in a single file (for iframe rendering)
- Load fonts via Google Fonts CDN
- Set `min-width: 800px` on body for proper iframe display

**design_system format (the interface contract):**

```json
{
  "id": "style-1",
  "name": "Warm Organic · 温暖有机",
  "description": "柔和暖色调，衬线字体营造优雅感，适合美食、生活类内容",
  "preview_html": "<!DOCTYPE html><html>...complete HTML/CSS...</html>",
  "design_system": {
    "colors": {
      "primary": "#C67C4E",
      "secondary": "#8B6914",
      "accent": "#E8956A",
      "background": "#FFF8F0",
      "text": "#3D2B1F"
    },
    "typography": {
      "heading_font": "Playfair Display",
      "body_font": "Inter",
      "google_fonts_url": "https://fonts.googleapis.com/css2?family=..."
    },
    "border_radius": "16px",
    "shadow_style": "0 2px 12px rgba(139,69,19,0.08)",
    "layout_pattern": "Hero + Card Grid",
    "effects": "Soft shadows, warm hover transitions (200ms ease)",
    "anti_patterns": ["Avoid neon colors", "No dark mode for food content"]
  }
}
```

Any design intelligence source can inform the values above. cc-design does not care where the recommendations came from — only that they are expressed in this format.

### Step 4: Show Previews

Call the MCP tool to serve previews:

```
create_style_preview({
  app_description: "美食博客网站",
  round: 1,
  styles: [ ...array of style objects from Step 3... ]
})
```

Tell the user to open the returned `preview_url` in their browser to view and select a style.

### Step 5: Get Selection

Call `get_user_selection({ session_id })` to check the user's choice.

Three possible outcomes:
- **`selected`** → proceed to Step 6 with the returned `design_system`
- **`regenerate`** → go back to Step 3, using `base_style` and `feedback` to guide new variants. Call `create_style_preview` with `session_id` (to append) and `round: 2` (or 3, etc.)
- **`pending`** → the user hasn't made a choice yet, wait and try again

### Step 6: Persist Design System

Save the selected style's design_system to the project:

Create `.cc-design/design-system.json`:

```json
{
  "version": "1.0",
  "project": "美食博客",
  "selected_style": "Warm Organic · 温暖有机",
  "selected_at": "2026-03-28T15:30:00Z",
  "design_system": { ...the selected design_system object... },
  "pre_delivery_checklist": [
    "No emojis as icons (use SVG: Heroicons/Lucide)",
    "cursor-pointer on all clickable elements",
    "Hover states with smooth transitions (150-300ms)",
    "Text contrast >= 4.5:1",
    "Focus states visible for keyboard nav",
    "Responsive: 375px, 768px, 1024px, 1440px"
  ]
}
```

### Step 7: Generate Application Code

Generate the full project code following the design_system strictly:
- Use the exact colors, fonts, border-radius, and shadow values
- Follow the layout_pattern
- Apply the effects described
- Avoid all listed anti_patterns
- Before delivering, check against the pre_delivery_checklist

### Step 8: Clean Up

Call `stop_preview({ session_id })` to shut down the preview server.

---

## Basic Style Reference (Fallback)

The tables below provide basic design guidance. **Use these only when you have no better source of design knowledge** — if you have access to specialized design skills, plugins, or detailed user-provided guidelines, prefer those.

### Common Style Families

| Style | Visual Keywords | Best For | Avoid For |
|-------|----------------|----------|-----------|
| Minimalism 极简主义 | Whitespace, sans-serif, monochrome | Tools, SaaS, docs | Children, entertainment |
| Glassmorphism 玻璃拟态 | Frosted glass, translucent, blur | SaaS, finance dashboards | Elderly users |
| Neumorphism 新拟态 | Soft raised/sunken, same-color shadows | Health, meditation, personal apps | Data-heavy UIs |
| Brutalism 粗野主义 | Thick borders, bold blocks, anti-convention | Portfolios, creative agencies | Banks, healthcare |
| Bento Grid 便当盒 | Uneven grid, modular cards | Dashboards, product pages | Long-form reading |
| Editorial 杂志编辑 | Columns, serif headings, strong typography | News, blogs, magazines | Tool apps |
| Dark Immersive 暗黑沉浸 | Dark bg, gradient accents, glow effects | Gaming, music, creative content | Health, children |
| Organic 有机自然 | Warm colors, rounded shapes, natural textures | Food, health, lifestyle | Tech, finance |
| Retro-Futurism 复古未来 | Neon, CRT effects, cyber | Gaming, entertainment, music | Enterprise, government |
| Flat Design 扁平化 | No shadows, solid colors, clean | Web apps, mobile, MVPs | Luxury brands |
| Aurora UI 极光 | Gradient mesh, soft glow | SaaS, creative agencies | Formal business |
| Claymorphism 黏土态 | 3D raised, soft shadows, rounded | Education, children's apps | Finance, legal |
| Y2K Aesthetic 千禧风 | Bright colors, stars, plastic | Fashion, Gen Z brands | Enterprise, B2B |
| Cyberpunk 赛博朋克 | Neon, dark, glitch effects | Gaming, crypto, tech | Health, education |
| Swiss Modernism 瑞士现代 | Grid system, Helvetica, order | Corporate, architecture | Entertainment |

### Basic Industry Rules

| Industry | Recommended Styles (Priority) | Color Tendency | Font Tendency | Must Avoid |
|----------|------------------------------|----------------|---------------|------------|
| Food/Dining | Organic > Editorial > Minimal | Warm (brown, orange, cream) | Serif headings + sans-serif body | Dark mode, neon colors |
| SaaS/Tools | Minimal > Glass > Bento | Blue/neutral gray | Sans-serif (Inter, Geist) | Flashy animations |
| E-commerce | Minimal > Bento > Flat | High-contrast CTA (orange, red) | Sans-serif, highly readable | Low-contrast text |
| Finance | Minimal > Glass > Swiss | Blue, green | Sans-serif, professional | Purple-pink gradients |
| Creative/Design | Brutalism > Dark > Editorial | Bold, unconventional | Mixed, display fonts | Conservative template feel |
| Health/Medical | Minimal > Organic > Flat | Blue, green, white | Clean sans-serif | Dark mode, brutalism |
| Education | Flat > Clay > Bento | Bright, friendly | Rounded sans-serif | Complex layouts, small fonts |
| Gaming | Dark > Cyberpunk > Retro | Neon, high saturation | Display, pixel | Corporate feel |
| Personal Blog | Editorial > Minimal > Organic | Depends on content | Serif or mixed | Over-commercialized |
| Corporate | Swiss > Minimal > Glass | Brand + neutral | Professional sans-serif | Flashy, unconventional |
