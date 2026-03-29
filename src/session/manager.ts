import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
  styles: Omit<StyleDefinition, 'preview_html'>[];
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
  timestamp: string;
}

export class SessionManager {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.join(os.tmpdir(), 'cc-design-sessions');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private sessionDir(id: string): string {
    return path.join(this.baseDir, id);
  }

  private metaPath(id: string): string {
    return path.join(this.sessionDir(id), 'meta.json');
  }

  private eventsPath(id: string): string {
    return path.join(this.sessionDir(id), 'events.json');
  }

  private roundDir(sessionId: string, roundNumber: number): string {
    return path.join(this.sessionDir(sessionId), `round-${roundNumber}`);
  }

  createSession(appDescription: string): Session {
    const id = randomUUID();
    const session: Session = {
      id,
      appDescription,
      rounds: [],
      createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(this.sessionDir(id), { recursive: true });
    fs.writeFileSync(this.metaPath(id), JSON.stringify(session, null, 2), 'utf-8');
    return session;
  }

  getSession(id: string): Session | null {
    try {
      const data = fs.readFileSync(this.metaPath(id), 'utf-8');
      return JSON.parse(data) as Session;
    } catch {
      return null;
    }
  }

  addRound(sessionId: string, roundNumber: number, styles: StyleDefinition[], roundLabel?: string): void {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const dir = this.roundDir(sessionId, roundNumber);
    fs.mkdirSync(dir, { recursive: true });

    const roundStyles: Omit<StyleDefinition, 'preview_html'>[] = [];

    for (const style of styles) {
      fs.writeFileSync(path.join(dir, `${style.id}.html`), style.preview_html, 'utf-8');

      const { preview_html: _, ...rest } = style;
      roundStyles.push(rest);
    }

    const round: Round = {
      number: roundNumber,
      ...(roundLabel !== undefined && { label: roundLabel }),
      styles: roundStyles,
    };

    session.rounds.push(round);
    fs.writeFileSync(this.metaPath(sessionId), JSON.stringify(session, null, 2), 'utf-8');
  }

  getEvents(sessionId: string): SessionEvent[] {
    try {
      const data = fs.readFileSync(this.eventsPath(sessionId), 'utf-8');
      return JSON.parse(data) as SessionEvent[];
    } catch {
      return [];
    }
  }

  recordEvent(sessionId: string, event: Omit<SessionEvent, 'timestamp'>): void {
    const events = this.getEvents(sessionId);
    events.push({ ...event, timestamp: new Date().toISOString() });
    fs.writeFileSync(this.eventsPath(sessionId), JSON.stringify(events, null, 2), 'utf-8');
  }

  findStyle(sessionId: string, styleId: string): StyleDefinition | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    for (const round of session.rounds) {
      const style = round.styles.find(s => s.id === styleId);
      if (style) {
        const htmlPath = path.join(this.roundDir(sessionId, round.number), `${styleId}.html`);
        try {
          const preview_html = fs.readFileSync(htmlPath, 'utf-8');
          return { ...style, preview_html };
        } catch {
          return { ...style, preview_html: '' };
        }
      }
    }

    return null;
  }

  getAllRounds(sessionId: string): Round[] {
    const session = this.getSession(sessionId);
    if (!session) return [];
    return session.rounds;
  }

  getPreviewHtml(sessionId: string, roundNumber: number, styleId: string): string | null {
    const htmlPath = path.join(this.roundDir(sessionId, roundNumber), `${styleId}.html`);
    try {
      return fs.readFileSync(htmlPath, 'utf-8');
    } catch {
      return null;
    }
  }

  clearEvents(sessionId: string): void {
    fs.writeFileSync(this.eventsPath(sessionId), JSON.stringify([], null, 2), 'utf-8');
  }

  destroySession(sessionId: string): void {
    const dir = this.sessionDir(sessionId);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
