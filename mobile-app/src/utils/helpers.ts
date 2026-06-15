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
  const parts = path.split(/[\\\/]/);
  return parts[parts.length - 1] || path;
}

/** Extract +N -M diff stats from a CODE_ACTION content string */
function getDiffStats(content: string): string {
  const added = content.match(/\+(\d+)/);
  const removed = content.match(/-(\d+)/);
  const parts: string[] = [];
  if (added) parts.push(`+${added[1]}`);
  if (removed) parts.push(`-${removed[1]}`);
  return parts.join(' ');
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
      return { icon: '📄', text: `Viewed ${file}${range}`, variant: 'info' };
    }
    case 'LIST_DIRECTORY': {
      return { icon: '📁', text: 'Listed directory', variant: 'info' };
    }
    case 'RUN_COMMAND': {
      if (msg.status === 'RUNNING') {
        const cmd = content.match(/CommandLine: (.+)/);
        const raw = cmd ? cmd[1].trim() : 'Running command...';
        return { icon: '⏳', text: raw.length > 60 ? raw.slice(0, 60) + '…' : raw, variant: 'running' };
      }
      const cmd = content.match(/CommandLine: (.+)/);
      const raw = cmd ? cmd[1].trim() : content.match(/Command: (.+)/)?.[1] || 'Command completed';
      return { icon: '▶', text: raw.length > 80 ? raw.slice(0, 80) + '…' : raw, variant: 'info' };
    }
    case 'CODE_ACTION': {
      const file = getFileName(content);
      const created = content.includes('Created file');
      const diff = getDiffStats(content);
      const verb = created ? 'Created' : 'Edited';
      const diffLabel = diff ? `  ${diff}` : '';
      return { icon: created ? '✨' : '⚙️', text: `${verb} ${file}${diffLabel}`, variant: 'info' };
    }
    case 'GENERATE_IMAGE':
      return { icon: '🖼️', text: 'Generated an image', variant: 'info' };
    case 'GREP_SEARCH': {
      const q = content.match(/Query: "(.+?)"/);
      return { icon: '🔍', text: q ? `Searched: ${q[1]}` : 'Searched codebase', variant: 'info' };
    }
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
