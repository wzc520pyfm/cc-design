import { describe, it, expect, afterAll } from 'vitest';
import { SessionManager } from '../src/session/manager.js';
import { PreviewServer } from '../src/http/server.js';
import { handleCreatePreview } from '../src/tools/create-preview.js';
import { handleGetSelection } from '../src/tools/get-selection.js';
import { handleStopPreview } from '../src/tools/stop-preview.js';

const sampleStyles = [
  {
    id: 'warm-organic',
    name: 'Warm Organic · 温暖有机',
    description: '柔和暖色调，衬线字体营造优雅感',
    preview_html: `<!DOCTYPE html><html><head><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Georgia, serif; background: #FFF8F0; color: #3D2B1F; min-width: 800px; }
      .nav { display:flex; justify-content:space-between; align-items:center; padding:20px 32px; border-bottom:1px solid #F0E6D8; }
      .nav-logo { font-size:22px; font-weight:700; color:#8B4513; }
      .hero { padding:64px 32px; text-align:center; background:linear-gradient(180deg,#FFF8F0,#FFECD2); }
      .hero h1 { font-size:42px; color:#3D2B1F; margin-bottom:16px; }
      .hero p { font-size:16px; color:#7A6352; max-width:500px; margin:0 auto 24px; }
      .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; padding:32px; }
      .card { border-radius:16px; background:white; box-shadow:0 2px 12px rgba(139,69,19,0.08); padding:24px; }
      .card h3 { font-size:18px; margin-bottom:8px; }
      .card p { font-size:14px; color:#7A6352; }
    </style></head><body>
      <div class="nav"><div class="nav-logo">味觉笔记</div></div>
      <div class="hero"><h1>探索美食的无限可能</h1><p>记录每一道菜的故事</p></div>
      <div class="cards">
        <div class="card"><h3>手工意面</h3><p>体验意大利面的手作魅力</p></div>
        <div class="card"><h3>春日沙拉</h3><p>时令蔬菜搭配柚子酱汁</p></div>
        <div class="card"><h3>法式甜点</h3><p>经典马卡龙制作秘诀</p></div>
      </div>
    </body></html>`,
    design_system: {
      colors: { primary: '#C67C4E', secondary: '#8B6914', accent: '#E8956A', background: '#FFF8F0', text: '#3D2B1F' },
      typography: { heading_font: 'Playfair Display', body_font: 'Inter', google_fonts_url: '' },
      border_radius: '16px', shadow_style: '0 2px 12px rgba(139,69,19,0.08)',
      layout_pattern: 'Hero + Card Grid', effects: 'Soft shadows, 200ms transitions',
      anti_patterns: ['No neon colors', 'No dark mode']
    }
  },
  {
    id: 'modern-minimal',
    name: 'Modern Minimal · 现代极简',
    description: '大留白、强排版、干净利落',
    preview_html: `<!DOCTYPE html><html><head><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: -apple-system, sans-serif; background: #fff; color: #111; min-width: 800px; }
      .nav { display:flex; justify-content:space-between; padding:20px 32px; }
      .nav-logo { font-size:20px; font-weight:700; letter-spacing:-1px; }
      .hero { padding:80px 32px 48px; }
      .hero h1 { font-size:56px; font-weight:700; letter-spacing:-2px; line-height:1.1; max-width:600px; }
      .hero p { font-size:16px; color:#666; max-width:400px; margin:16px 0 28px; }
      .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:#eee; margin:0 32px; }
      .grid-item { background:white; padding:24px; }
      .grid-item h3 { font-size:15px; font-weight:600; margin-bottom:8px; }
      .grid-item p { font-size:13px; color:#888; }
    </style></head><body>
      <div class="nav"><div class="nav-logo">味觉笔记</div></div>
      <div class="hero"><h1>用心烹饪，用爱记录</h1><p>关于美食、烹饪和生活方式的个人空间</p></div>
      <div class="grid">
        <div class="grid-item"><h3>柠檬罗勒烤鸡</h3><p>简单优雅的周末晚餐</p></div>
        <div class="grid-item"><h3>抹茶提拉米苏</h3><p>经典甜点的东方演绎</p></div>
        <div class="grid-item"><h3>完美牛排指南</h3><p>从选肉到装盘的教程</p></div>
      </div>
    </body></html>`,
    design_system: {
      colors: { primary: '#111111', secondary: '#666666', accent: '#000000', background: '#FFFFFF', text: '#111111' },
      typography: { heading_font: 'Inter', body_font: 'Inter', google_fonts_url: '' },
      border_radius: '0px', shadow_style: 'none',
      layout_pattern: 'Hero + Grid', effects: 'Minimal, clean transitions',
      anti_patterns: ['No decorative elements', 'No rounded corners']
    }
  }
];

describe('Integration: full preview lifecycle', () => {
  const sessionManager = new SessionManager();
  const previewServer = new PreviewServer(sessionManager);
  let sessionId: string;

  afterAll(async () => {
    await previewServer.stop();
    try { sessionManager.destroySession(sessionId); } catch {}
  });

  it('creates a preview session and starts HTTP server', async () => {
    const result = await handleCreatePreview(sessionManager, previewServer, {
      app_description: '美食博客网站',
      round: 1,
      styles: sampleStyles,
    });

    sessionId = result.session_id;
    expect(result.session_id).toBeTruthy();
    expect(result.preview_url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(result.total_styles).toBe(2);
    expect(previewServer.isRunning()).toBe(true);
  });

  it('serves the gallery page', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('cc-design');
    expect(html).toContain('美食博客网站');
  });

  it('serves styles-data JSON', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(`${url}/styles-data`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rounds).toHaveLength(1);
    expect(data.rounds[0].styles).toHaveLength(2);
    expect(data.appDescription).toBe('美食博客网站');
  });

  it('serves individual preview HTML', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(`${url}/preview/${sessionId}/1/warm-organic`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('味觉笔记');
    expect(html).toContain('探索美食的无限可能');
  });

  it('returns pending when no selection yet', async () => {
    const result = await handleGetSelection(sessionManager, { session_id: sessionId });
    expect(result.status).toBe('pending');
  });

  it('handles style selection via API', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(`${url}/api/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styleId: 'warm-organic' }),
    });
    expect(res.status).toBe(200);

    const result = await handleGetSelection(sessionManager, { session_id: sessionId });
    expect(result.status).toBe('selected');
    expect(result.selected_style?.id).toBe('warm-organic');
    expect(result.selected_style?.name).toBe('Warm Organic · 温暖有机');
    expect(result.selected_style?.design_system.colors.primary).toBe('#C67C4E');
  });

  it('handles regeneration request via API', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(`${url}/api/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_style: 'Glassmorphism', feedback: '想要更现代一点' }),
    });
    expect(res.status).toBe(200);

    const result = await handleGetSelection(sessionManager, { session_id: sessionId });
    expect(result.status).toBe('regenerate');
    expect(result.base_style).toBe('Glassmorphism');
    expect(result.feedback).toBe('想要更现代一点');
    expect(result.keep_previous).toBe(true);
  });

  it('appends a second round of styles', async () => {
    const result = await handleCreatePreview(sessionManager, previewServer, {
      session_id: sessionId,
      app_description: '美食博客网站',
      round: 2,
      round_label: '基于「Glassmorphism」',
      styles: [{
        id: 'glass-warm',
        name: 'Glass Warm · 玻璃暖风',
        description: '毛玻璃效果搭配暖色调',
        preview_html: '<html><body><h1>Glass Warm Preview</h1></body></html>',
        design_system: {
          colors: { primary: '#E8956A', secondary: '#C67C4E', accent: '#FF9F43', background: 'rgba(255,248,240,0.8)', text: '#3D2B1F' },
          typography: { heading_font: 'Inter', body_font: 'Inter', google_fonts_url: '' },
          border_radius: '20px', shadow_style: 'glassmorphism',
          layout_pattern: 'Glass Cards', effects: 'Backdrop blur, frosted glass',
          anti_patterns: ['No harsh borders']
        }
      }],
    });

    expect(result.total_styles).toBe(3);
    expect(result.session_id).toBe(sessionId);
  });

  it('shows both rounds in styles-data', async () => {
    const url = previewServer.getUrl();
    const res = await fetch(`${url}/styles-data`);
    const data = await res.json();
    expect(data.rounds).toHaveLength(2);
  });

  it('stops the preview server cleanly', async () => {
    const result = await handleStopPreview(previewServer, sessionManager, { session_id: sessionId });
    expect(result.status).toBe('stopped');
    expect(previewServer.isRunning()).toBe(false);
    expect(sessionManager.getSession(sessionId)).toBeNull();
  });
});
