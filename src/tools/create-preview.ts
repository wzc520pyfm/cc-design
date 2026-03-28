import { SessionManager, StyleDefinition } from '../session/manager.js';
import { PreviewServer } from '../http/server.js';

export interface CreatePreviewParams {
  session_id?: string;
  app_description: string;
  round: number;
  round_label?: string;
  styles: StyleDefinition[];
}

export interface CreatePreviewResult {
  session_id: string;
  preview_url: string;
  total_styles: number;
}

export async function handleCreatePreview(
  sessionManager: SessionManager,
  previewServer: PreviewServer,
  params: CreatePreviewParams
): Promise<CreatePreviewResult> {
  let sessionId = params.session_id;

  if (!sessionId) {
    const session = sessionManager.createSession(params.app_description);
    sessionId = session.id;
  }

  sessionManager.addRound(sessionId, params.round, params.styles, params.round_label);

  if (!previewServer.isRunning()) {
    await previewServer.start(sessionId);
  }

  const session = sessionManager.getSession(sessionId);
  const totalStyles = session ? session.rounds.reduce((sum, r) => sum + r.styles.length, 0) : 0;

  return {
    session_id: sessionId,
    preview_url: previewServer.getUrl(),
    total_styles: totalStyles
  };
}
