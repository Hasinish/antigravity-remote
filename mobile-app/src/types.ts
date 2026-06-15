export interface Message {
  step_index: number;
  source: string;
  type: string;
  content?: string;
  created_at?: string;
  tool_calls?: any[];
  status?: string;
}

export interface Activity {
  icon: string;
  text: string;
  variant: 'info' | 'error' | 'running';
}

export interface Conversation {
  id: string;
  title: string;
  mtime: number;
  active: boolean;
}
