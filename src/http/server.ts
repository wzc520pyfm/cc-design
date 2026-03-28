import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '../session/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_DIR = path.join(PROJECT_ROOT, 'src', 'client');
const DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export class PreviewServer {
  private server: http.Server | null = null;
  private sessionId: string | null = null;
  private port: number = 0;
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  async start(sessionId: string): Promise<{ port: number; url: string }> {
    if (this.isRunning() && this.sessionId === sessionId) {
      return { port: this.port, url: `http://localhost:${this.port}` };
    }

    if (this.isRunning()) {
      await this.stop();
    }

    this.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      const tryPort = (port: number) => {
        this.server!.listen(port, () => {
          this.port = port;
          resolve({ port, url: `http://localhost:${port}` });
        });
        this.server!.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE' && port < 52780) {
            this.server!.removeAllListeners('error');
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
      };
      tryPort(52680);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.sessionId = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const pathname = url.pathname;

    try {
      if (req.method === 'GET' && pathname === '/') {
        this.serveGalleryPage(res);
      } else if (req.method === 'GET' && pathname.startsWith('/preview/')) {
        this.servePreview(pathname, res);
      } else if (req.method === 'GET' && pathname === '/styles-data') {
        this.serveStylesData(res);
      } else if (req.method === 'GET' && pathname === '/gallery.css') {
        this.serveStaticFile(path.join(CLIENT_DIR, 'gallery.css'), res);
      } else if (req.method === 'GET' && pathname === '/gallery.js') {
        this.serveStaticFile(path.join(CLIENT_DIR, 'gallery.js'), res);
      } else if (req.method === 'GET' && pathname === '/style-families.json') {
        this.serveStaticFile(path.join(DATA_DIR, 'style-families.json'), res);
      } else if (req.method === 'POST' && pathname === '/api/select') {
        await this.handleSelect(req, res);
      } else if (req.method === 'POST' && pathname === '/api/regenerate') {
        await this.handleRegenerate(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private serveGalleryPage(res: http.ServerResponse): void {
    const htmlPath = path.join(CLIENT_DIR, 'gallery.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    const session = this.sessionId ? this.sessionManager.getSession(this.sessionId) : null;
    const appDescription = session?.appDescription ?? '';

    html = html.replace(/\{\{SESSION_ID\}\}/g, this.sessionId ?? '');
    html = html.replace(/\{\{APP_DESCRIPTION\}\}/g, appDescription);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private servePreview(pathname: string, res: http.ServerResponse): void {
    const segments = pathname.split('/').filter(Boolean);
    // /preview/{sessionId}/{roundNumber}/{styleId}
    if (segments.length !== 4) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const [, sessionId, roundStr, styleId] = segments;
    const roundNumber = parseInt(roundStr, 10);

    if (isNaN(roundNumber)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid round number' }));
      return;
    }

    const html = this.sessionManager.getPreviewHtml(sessionId, roundNumber, styleId);
    if (html === null) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Preview not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private serveStylesData(res: http.ServerResponse): void {
    if (!this.sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active session' }));
      return;
    }

    const session = this.sessionManager.getSession(this.sessionId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      sessionId: session.id,
      appDescription: session.appDescription,
      rounds: session.rounds,
    }));
  }

  private serveStaticFile(filePath: string, res: http.ServerResponse): void {
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
  }

  private async handleSelect(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await parseBody(req);
    const { styleId } = JSON.parse(body);
    this.sessionManager.recordEvent(this.sessionId!, { type: 'select', styleId });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  }

  private async handleRegenerate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await parseBody(req);
    const { base_style, feedback } = JSON.parse(body);
    this.sessionManager.recordEvent(this.sessionId!, { type: 'regenerate', base_style, feedback });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  }
}
