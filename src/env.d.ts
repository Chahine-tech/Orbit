import type { Workspace, Tab, Settings } from './types';

declare global {
  interface Window {
    api: {
      getWorkspaces: () => Promise<Workspace[]>;
      addWorkspace: (folderPath: string) => Promise<Workspace>;
      removeWorkspace: (id: string) => Promise<void>;
      openFolderDialog: () => Promise<string | null>;
      getBranch: (workspacePath: string) => Promise<string | null>;
      getTabsState: () => Promise<{ activeId: string | null; tabs: Record<string, Tab[]>; activeTabId: Record<string, string> } | null>;
      saveTabsState: (state: { activeId: string | null; tabs: Record<string, Tab[]>; activeTabId: Record<string, string> }) => Promise<void>;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
      ptyCreate: (workspaceId: string, workspacePath: string, cols: number, rows: number) => Promise<void>;
      ptyWrite: (workspaceId: string, data: string) => Promise<void>;
      ptyResize: (workspaceId: string, cols: number, rows: number) => Promise<void>;
      ptyKill: (workspaceId: string) => Promise<void>;
      onPtyData: (callback: (workspaceId: string, data: string) => void) => () => void;
      onPtyExit: (callback: (workspaceId: string) => void) => () => void;
      onBranchChange: (callback: (workspacePath: string, branch: string | null) => void) => () => void;
      onShortcut: (callback: (action: string, payload: Record<string, unknown>) => void) => () => void;
    };
  }
}
