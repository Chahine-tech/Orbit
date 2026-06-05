export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export interface Tab {
  id: string;
  workspaceId: string;
  label: string;
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
