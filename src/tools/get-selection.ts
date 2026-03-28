import { SessionManager } from '../session/manager.js';

export interface GetSelectionResult {
  status: 'selected' | 'regenerate' | 'pending';
  selected_style?: {
    id: string;
    name: string;
    design_system: any;
  };
  base_style?: string;
  feedback?: string;
  keep_previous?: boolean;
}

export async function handleGetSelection(
  sessionManager: SessionManager,
  params: { session_id: string }
): Promise<GetSelectionResult> {
  const events = sessionManager.getEvents(params.session_id);

  if (events.length === 0) {
    return { status: 'pending' };
  }

  const lastEvent = events[events.length - 1];

  if (lastEvent.type === 'select' && lastEvent.styleId) {
    const style = sessionManager.findStyle(params.session_id, lastEvent.styleId);
    if (style) {
      return {
        status: 'selected',
        selected_style: {
          id: style.id,
          name: style.name,
          design_system: style.design_system
        }
      };
    }
    return { status: 'pending' };
  }

  if (lastEvent.type === 'regenerate') {
    return {
      status: 'regenerate',
      base_style: lastEvent.base_style,
      feedback: lastEvent.feedback,
      keep_previous: true
    };
  }

  return { status: 'pending' };
}
