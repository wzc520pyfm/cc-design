import { SessionManager } from '../session/manager.js';
import { PreviewServer } from '../http/server.js';

export async function handleStopPreview(
  previewServer: PreviewServer,
  sessionManager: SessionManager,
  params: { session_id: string }
): Promise<{ status: string }> {
  await previewServer.stop();
  sessionManager.destroySession(params.session_id);
  return { status: 'stopped' };
}
