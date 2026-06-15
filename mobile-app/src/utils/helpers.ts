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
  // Try matching file:/// format
  const fileUrlMatch = content.match(/file:\/\/\/[^\s`]+/);
  if (fileUrlMatch) {
    const path = fileUrlMatch[0].replace('file:///', '');
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || path;
  }
  
  // Try matching absolute Windows path (e.g., D:\path\to\file.ext)
  const winPathMatch = content.match(/[a-zA-Z]:\\[^\s`:]+/);
  if (winPathMatch) {
    const path = winPathMatch[0];
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || path;
  }

  // Try matching Unix absolute path
  const unixPathMatch = content.match(/\/[^\s`:]+/);
  if (unixPathMatch) {
    const path = unixPathMatch[0];
    const parts = path.split(/[\\\/]/);
    return parts[parts.length - 1] || path;
  }

  return 'file';
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

function mapToolNameToStepType(toolName: string): string {
  switch (toolName) {
    case 'run_command':
      return 'RUN_COMMAND';
    case 'view_file':
      return 'VIEW_FILE';
    case 'list_dir':
    case 'list_directory':
      return 'LIST_DIRECTORY';
    case 'grep_search':
      return 'GREP_SEARCH';
    case 'search_web':
      return 'SEARCH_WEB';
    case 'browser_subagent':
      return 'BROWSER_SUBAGENT';
    case 'write_to_file':
    case 'replace_file_content':
    case 'multi_replace_file_content':
      return 'CODE_ACTION';
    case 'generate_image':
      return 'GENERATE_IMAGE';
    default:
      return 'GENERIC';
  }
}

function findInitiatingToolCall(messages: Message[], currentIndex: number) {
  const currentMsg = messages[currentIndex];
  let toolTypeCount = 0;
  
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevMsg = messages[i];
    if (prevMsg.source === 'MODEL' && prevMsg.type === 'PLANNER_RESPONSE') {
      if (prevMsg.tool_calls) {
        const matchingCalls = prevMsg.tool_calls.filter(tc => {
          return mapToolNameToStepType(tc.name) === currentMsg.type;
        });
        
        if (toolTypeCount >= 0 && toolTypeCount < matchingCalls.length) {
          return matchingCalls[toolTypeCount];
        }
      }
      break;
    }
    if (prevMsg.type === currentMsg.type) {
      toolTypeCount++;
    }
  }
  return null;
}

export function summarizeActivity(msg: Message, isLast: boolean, messages?: Message[], currentIndex?: number): Activity | null {
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

  switch (msg.type) {
    case 'VIEW_FILE': {
      let fileName = '';
      if (messages && typeof currentIndex === 'number') {
        const initiatingCall = findInitiatingToolCall(messages, currentIndex);
        if (initiatingCall && initiatingCall.args?.AbsolutePath) {
          const path = initiatingCall.args.AbsolutePath.toString().replace(/^"|"$/g, '').trim();
          const parts = path.split(/[\\\/]/);
          fileName = parts[parts.length - 1] || path;
        }
      }
      if (!fileName) {
        fileName = getFileName(content);
      }
      const isTask = fileName === 'task.md' || fileName === 'task';
      return { icon: isTask ? '📋' : '📄', text: `Explored 1 ${isTask ? 'task' : 'file'}`, variant: 'info' };
    }
    case 'LIST_DIRECTORY': {
      let filesCount = 0;
      let foldersCount = 0;
      let tasksCount = 0;
      
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
          try {
            const item = JSON.parse(line.trim());
            if (item.isDir) {
              foldersCount++;
            } else if (item.name === 'task.md' || item.name === 'task') {
              tasksCount++;
            } else {
              filesCount++;
            }
          } catch (e) {}
        }
      }
      
      const parts: string[] = [];
      if (filesCount > 0) parts.push(`${filesCount} file${filesCount === 1 ? '' : 's'}`);
      if (foldersCount > 0) parts.push(`${foldersCount} folder${foldersCount === 1 ? '' : 's'}`);
      if (tasksCount > 0) parts.push(`${tasksCount} task${tasksCount === 1 ? '' : 's'}`);
      
      const summary = parts.length > 0 ? parts.join(', ') : 'directory';
      return { icon: '📁', text: `Explored ${summary}`, variant: 'info' };
    }
    case 'RUN_COMMAND': {
      let cmdName = '';
      if (messages && typeof currentIndex === 'number') {
        const initiatingCall = findInitiatingToolCall(messages, currentIndex);
        if (initiatingCall && initiatingCall.args?.CommandLine) {
          cmdName = initiatingCall.args.CommandLine.toString().replace(/^"|"$/g, '').trim();
        }
      }
      
      if (!cmdName) {
        const cmd = content.match(/CommandLine: (.+)/);
        cmdName = cmd ? cmd[1].trim() : content.match(/Command: (.+)/)?.[1] || 'Command completed';
      }
      
      const displayCmd = cmdName.length > 80 ? cmdName.slice(0, 80) + '…' : cmdName;
      if (msg.status === 'RUNNING') {
        return { icon: '⏳', text: `Run ${displayCmd}`, variant: 'running' };
      }
      return { icon: '▶', text: `Ran ${displayCmd}`, variant: 'info' };
    }
    case 'CODE_ACTION': {
      let fileName = '';
      if (messages && typeof currentIndex === 'number') {
        const initiatingCall = findInitiatingToolCall(messages, currentIndex);
        if (initiatingCall && initiatingCall.args?.TargetFile) {
          const path = initiatingCall.args.TargetFile.toString().replace(/^"|"$/g, '').trim();
          const parts = path.split(/[\\\/]/);
          fileName = parts[parts.length - 1] || path;
        }
      }
      if (!fileName) {
        fileName = getFileName(content);
      }
      
      const isReact = /\.(tsx|ts|jsx|js)$/.test(fileName);
      const isMd = /\.md$/.test(fileName);
      
      const created = content.includes('Created file');
      const diff = getDiffStats(content);
      const verb = created ? 'Created' : 'Edited';
      const diffLabel = diff ? `  ${diff}` : '';
      
      let icon = '⚙️';
      if (created) {
        icon = '✨';
      } else if (isReact) {
        icon = '⚛️';
      } else if (isMd) {
        icon = '📝';
      }
      
      return { icon, text: `${verb} ${fileName}${diffLabel}`, variant: 'info' };
    }
    case 'GENERATE_IMAGE':
      return { icon: '🖼️', text: 'Generated an image', variant: 'info' };
    case 'GREP_SEARCH': {
      let query = '';
      if (messages && typeof currentIndex === 'number') {
        const initiatingCall = findInitiatingToolCall(messages, currentIndex);
        if (initiatingCall && initiatingCall.args?.Query) {
          query = initiatingCall.args.Query.toString().replace(/^"|"$/g, '').trim();
        }
      }
      if (!query) {
        const q = content.match(/Query: "(.+?)"/);
        query = q ? q[1] : '';
      }
      return { icon: '🔍', text: query ? `Searched: ${query}` : 'Searched codebase', variant: 'info' };
    }
    case 'SEARCH_WEB': {
      let query = '';
      if (messages && typeof currentIndex === 'number') {
        const initiatingCall = findInitiatingToolCall(messages, currentIndex);
        if (initiatingCall && initiatingCall.args?.query) {
          query = initiatingCall.args.query.toString().replace(/^"|"$/g, '').trim();
        }
      }
      if (!query) {
        const q = content.match(/The search for "(.+?)"/);
        query = q ? q[1] : '';
      }
      return { icon: '🌐', text: query ? `Searched: ${query}` : 'Searched the web', variant: 'info' };
    }
    case 'BROWSER_SUBAGENT':
      return { icon: '🌐', text: `Browser task ${msg.status === 'CANCELED' ? 'cancelled' : 'completed'}`, variant: 'info' };
    case 'GENERIC': {
      let taskLabel = '';
      const taskIdMatch = content.match(/task-\d+/);
      if (taskIdMatch && messages && typeof currentIndex === 'number') {
        const taskId = taskIdMatch[0];
        let initiatingIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i--) {
          const prev = messages[i];
          if (prev && prev.content && prev.content.includes(taskId)) {
            initiatingIndex = i;
            break;
          }
        }
        if (initiatingIndex !== -1) {
          const initiatingCall = findInitiatingToolCall(messages, initiatingIndex);
          if (initiatingCall && initiatingCall.args?.toolSummary) {
            taskLabel = initiatingCall.args.toolSummary.toString().replace(/^"|"$/g, '').trim();
          }
        }
      }

      if (msg.status === 'RUNNING') {
        const desc = content.match(/Task Description: (.+)/);
        const fallbackDesc = desc ? desc[1] : 'Running background task...';
        return { icon: '⏳', text: taskLabel ? `Running: ${taskLabel}` : fallbackDesc, variant: 'running' };
      }
      
      const finishedSuffix = ' finished';
      if (taskLabel) {
        return { 
          icon: '⚙️', 
          text: `${taskLabel}${finishedSuffix}`, 
          variant: 'divider' 
        };
      }
      
      const desc = content.match(/Task Description: (.+)/);
      const text = desc ? desc[1] : 'Background task update';
      return { icon: '⚙️', text, variant: 'info' };
    }
    default:
      return null;
  }
}
