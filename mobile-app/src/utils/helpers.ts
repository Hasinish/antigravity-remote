import { Message, Activity } from '../types';

export function formatRelativeTime(mtime: number): string {
  const diffMs = Date.now() - mtime;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getFileName(content: string): string {
  const match = content.match(/file:\/\/\/[^\s`]+/);
  if (!match) return 'file';
  const path = match[0].replace('file:///', '');
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function summarizeActivity(msg: Message, isLast: boolean): Activity | null {
  const content = msg.content || '';

  if (msg.source === 'SYSTEM' && ['CONVERSATION_HISTORY', 'KNOWLEDGE_ARTIFACTS', 'SYSTEM_MESSAGE', 'CHECKPOINT'].includes(msg.type)) {
    return null;
  }

  if (msg.source === 'SYSTEM' && msg.type === 'ERROR_MESSAGE') {
    const firstLine = content.split('\n').find((l) => l.trim()) || 'Error';
    return { icon: '⚠️', text: firstLine.slice(0, 140), variant: 'error' };
  }

  if (msg.status === 'ERROR') {
    const errMatch = content.match(/Encountered error[^\n]*/);
    return { icon: '⚠️', text: (errMatch ? errMatch[0] : 'An error occurred').slice(0, 140), variant: 'error' };
  }

  if (msg.source === 'MODEL' && msg.type === 'PLANNER_RESPONSE' && !content && msg.tool_calls?.length) {
    if (!isLast) return null;
    const action = msg.tool_calls
      .map((tc) => (tc.args?.toolAction || tc.args?.toolSummary || tc.name || '').toString().replace(/^"|"$/g, ''))
      .join(', ');
    return { icon: '⚡', text: action || 'Working...', variant: 'running' };
  }

  const isUserAction = msg.source === 'USER_EXPLICIT';

  switch (msg.type) {
    case 'VIEW_FILE': {
      const file = getFileName(content);
      const lines = content.match(/Showing lines (\d+) to (\d+)/);
      const range = lines ? ` (lines ${lines[1]}-${lines[2]})` : '';
      return { icon: '📄', text: `${isUserAction ? 'You viewed' : 'Viewed'} ${file}${range}`, variant: 'info' };
    }
    case 'LIST_DIRECTORY': {
      const summary = content.match(/Summary: (.+)/);
      return { icon: '📁', text: summary ? summary[1] : 'Listed a directory', variant: 'info' };
    }
    case 'RUN_COMMAND': {
      if (msg.status === 'RUNNING') {
        const desc = content.match(/Task Description: (.+)/);
        return { icon: '⏳', text: desc ? `Running: ${desc[1]}` : 'Running command...', variant: 'running' };
      }
      const cmd = content.match(/Command: (.+)/);
      if (cmd) {
        return { icon: '▶️', text: `${isUserAction ? 'You ran' : 'Ran'}: ${cmd[1]}`, variant: 'info' };
      }
      return { icon: '▶️', text: 'Command completed', variant: 'info' };
    }
    case 'CODE_ACTION': {
      const file = getFileName(content);
      const created = content.includes('Created file');
      const verb = isUserAction ? 'You edited' : created ? 'Created' : 'Edited';
      return { icon: '✏️', text: `${verb} ${file}`, variant: 'info' };
    }
    case 'GENERATE_IMAGE':
      return { icon: '🖼️', text: 'Generated an image', variant: 'info' };
    case 'GREP_SEARCH':
      return { icon: '🔍', text: 'Searched the codebase', variant: 'info' };
    case 'SEARCH_WEB': {
      const q = content.match(/The search for "(.+?)"/);
      return { icon: '🌐', text: q ? `Searched: ${q[1]}` : 'Searched the web', variant: 'info' };
    }
    case 'BROWSER_SUBAGENT':
      return { icon: '🌐', text: `Browser task ${msg.status === 'CANCELED' ? 'cancelled' : 'completed'}`, variant: 'info' };
    case 'GENERIC': {
      const desc = content.match(/Task Description: (.+)/);
      if (msg.status === 'RUNNING') {
        return { icon: '⏳', text: desc ? desc[1] : 'Running background task...', variant: 'running' };
      }
      return { icon: '⚙️', text: desc ? desc[1] : 'Background task update', variant: 'info' };
    }
    default:
      return null;
  }
}
