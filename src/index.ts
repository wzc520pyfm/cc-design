import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { SessionManager } from './session/manager.js';
import { PreviewServer } from './http/server.js';
import { handleCreatePreview } from './tools/create-preview.js';
import { handleGetSelection } from './tools/get-selection.js';
import { handleStopPreview } from './tools/stop-preview.js';

const sessionManager = new SessionManager();
const previewServer = new PreviewServer(sessionManager);

const server = new McpServer({
  name: 'cc-design',
  version: '0.1.0',
});

const designSystemSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }),
  typography: z.object({
    heading_font: z.string(),
    body_font: z.string(),
    google_fonts_url: z.string(),
  }),
  border_radius: z.string(),
  shadow_style: z.string(),
  layout_pattern: z.string(),
  effects: z.string(),
  anti_patterns: z.array(z.string()),
});

const styleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preview_html: z.string(),
  design_system: designSystemSchema,
});

server.tool(
  'create_style_preview',
  'Submit UI style previews and launch the browser gallery for user selection',
  {
    session_id: z.string().optional().describe('Reuse an existing session (for appending new rounds)'),
    app_description: z.string().describe('What the user wants to build, e.g. "美食博客网站"'),
    round: z.number().describe('Round number, starting from 1'),
    round_label: z.string().optional().describe('Label for this round, e.g. "基于 Glassmorphism"'),
    styles: z.array(styleSchema).describe('3-4 style variants with preview HTML and design system'),
  },
  async (params) => {
    const result = await handleCreatePreview(sessionManager, previewServer, {
      session_id: params.session_id,
      app_description: params.app_description,
      round: params.round,
      round_label: params.round_label,
      styles: params.styles,
    });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'get_user_selection',
  'Check if the user has selected a style or requested regeneration',
  {
    session_id: z.string().describe('The session ID from create_style_preview'),
  },
  async (params) => {
    const result = await handleGetSelection(sessionManager, params);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'stop_preview',
  'Stop the preview server and clean up the session',
  {
    session_id: z.string().describe('The session ID to stop'),
  },
  async (params) => {
    const result = await handleStopPreview(previewServer, sessionManager, params);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
