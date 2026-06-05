export interface Workspace {
  id: string;
  name: string;
  path: string;
  color?: string;
}

export interface Tab {
  id: string;
  workspaceId: string;
  label: string;
  restartCount?: number;
  splitSessionId?: string;
  splitDirection?: 'horizontal' | 'vertical';
  splitRestartCount?: number;
}

export interface Settings {
  fontFamily: string;
  fontSize: number;
  shell: string;
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace',
  fontSize: 13,
  shell: 'claude',
};
