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
  worktreePath?: string;   // absolute path to the git worktree directory
  worktreeBranch?: string; // branch name, used for display and cleanup
}

export interface Settings {
  fontFamily: string;
  fontSize: number;
  shell: string;
  autoStart: boolean;
  sidebarCompact: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace',
  fontSize: 13,
  shell: 'claude',
  autoStart: false,
  sidebarCompact: false,
};
