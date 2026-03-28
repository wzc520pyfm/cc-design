import { describe, it, expect, afterEach } from 'vitest';
import { SessionManager } from '../src/session/manager.js';

describe('SessionManager', () => {
  const manager = new SessionManager();
  const createdSessions: string[] = [];

  afterEach(() => {
    createdSessions.forEach(id => {
      try { manager.destroySession(id); } catch {}
    });
    createdSessions.length = 0;
  });

  it('creates a session with unique ID', () => {
    const session = manager.createSession('美食博客');
    createdSessions.push(session.id);
    expect(session.id).toBeTruthy();
    expect(session.appDescription).toBe('美食博客');
    expect(session.rounds).toEqual([]);
  });

  it('retrieves a created session', () => {
    const session = manager.createSession('test app');
    createdSessions.push(session.id);
    const retrieved = manager.getSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.appDescription).toBe('test app');
  });

  it('returns null for non-existent session', () => {
    expect(manager.getSession('non-existent-id')).toBeNull();
  });

  it('adds a round of styles', () => {
    const session = manager.createSession('test');
    createdSessions.push(session.id);
    const styles = [{
      id: 'style-1', name: 'Warm Organic', description: 'Warm tones',
      preview_html: '<div>warm preview</div>',
      design_system: {
        colors: { primary: '#C67C4E', secondary: '#8B6914', accent: '#E8956A', background: '#FFF8F0', text: '#3D2B1F' },
        typography: { heading_font: 'Playfair Display', body_font: 'Inter', google_fonts_url: '' },
        border_radius: '16px', shadow_style: 'soft', layout_pattern: 'Hero + Cards',
        effects: 'Soft shadows', anti_patterns: ['No neon']
      }
    }];
    manager.addRound(session.id, 1, styles, 'First round');
    const updated = manager.getSession(session.id);
    expect(updated!.rounds).toHaveLength(1);
    expect(updated!.rounds[0].number).toBe(1);
    expect(updated!.rounds[0].label).toBe('First round');
    expect(updated!.rounds[0].styles).toHaveLength(1);
    expect(updated!.rounds[0].styles[0].name).toBe('Warm Organic');
  });

  it('stores and retrieves preview HTML separately', () => {
    const session = manager.createSession('test');
    createdSessions.push(session.id);
    manager.addRound(session.id, 1, [{
      id: 'style-1', name: 'Test', description: 'desc',
      preview_html: '<html><body>Hello</body></html>',
      design_system: {
        colors: { primary: '#000', secondary: '#111', accent: '#222', background: '#fff', text: '#000' },
        typography: { heading_font: 'Inter', body_font: 'Inter', google_fonts_url: '' },
        border_radius: '8px', shadow_style: 'none', layout_pattern: 'Grid',
        effects: '', anti_patterns: []
      }
    }]);
    const html = manager.getPreviewHtml(session.id, 1, 'style-1');
    expect(html).toBe('<html><body>Hello</body></html>');
  });

  it('records and retrieves events', () => {
    const session = manager.createSession('test');
    createdSessions.push(session.id);
    manager.recordEvent(session.id, { type: 'select', styleId: 'style-1' });
    const events = manager.getEvents(session.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('select');
    expect(events[0].styleId).toBe('style-1');
    expect(events[0].timestamp).toBeTruthy();
  });

  it('records regenerate event with base_style and feedback', () => {
    const session = manager.createSession('test');
    createdSessions.push(session.id);
    manager.recordEvent(session.id, { type: 'regenerate', base_style: 'Glassmorphism', feedback: 'warmer' });
    const events = manager.getEvents(session.id);
    expect(events[0].type).toBe('regenerate');
    expect(events[0].base_style).toBe('Glassmorphism');
    expect(events[0].feedback).toBe('warmer');
  });

  it('finds a style by ID across rounds', () => {
    const session = manager.createSession('test');
    createdSessions.push(session.id);
    const ds = {
      colors: { primary: '#C67C4E', secondary: '#8B6914', accent: '#E8956A', background: '#FFF8F0', text: '#3D2B1F' },
      typography: { heading_font: 'Playfair', body_font: 'Inter', google_fonts_url: '' },
      border_radius: '16px', shadow_style: 'soft', layout_pattern: 'Cards',
      effects: '', anti_patterns: []
    };
    manager.addRound(session.id, 1, [
      { id: 's1', name: 'Style A', description: 'a', preview_html: '<div>A</div>', design_system: ds }
    ]);
    manager.addRound(session.id, 2, [
      { id: 's2', name: 'Style B', description: 'b', preview_html: '<div>B</div>', design_system: ds }
    ]);
    const found = manager.findStyle(session.id, 's2');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Style B');
    expect(found!.preview_html).toBe('<div>B</div>');
  });

  it('destroys a session completely', () => {
    const session = manager.createSession('test');
    manager.destroySession(session.id);
    expect(manager.getSession(session.id)).toBeNull();
  });
});
