import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getWorkspaces: () => ipcRenderer.invoke('workspaces:get'),
  addWorkspace: (folderPath: string) => ipcRenderer.invoke('workspaces:add', { folderPath }),
  removeWorkspace: (id: string) => ipcRenderer.invoke('workspaces:remove', { id }),
  reorderWorkspaces: (ids: string[]) => ipcRenderer.invoke('workspaces:reorder', { ids }),
  setWorkspaceColor: (id: string, color: string) => ipcRenderer.invoke('workspaces:set-color', { id, color }),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  saveLog: (content: string, filename: string) => ipcRenderer.invoke('dialog:save-log', { content, filename }),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  getBranch: (workspacePath: string) => ipcRenderer.invoke('git:branch', { workspacePath }),

  getTabsState: () => ipcRenderer.invoke('tabs:get'),
  saveTabsState: (state: unknown) => ipcRenderer.invoke('tabs:save', state),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  ptyCreate: (workspaceId: string, workspacePath: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:create', { workspaceId, workspacePath, cols, rows }),
  ptyWrite: (workspaceId: string, data: string) =>
    ipcRenderer.invoke('pty:write', { workspaceId, data }),
  ptyResize: (workspaceId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:resize', { workspaceId, cols, rows }),
  ptyKill: (workspaceId: string) =>
    ipcRenderer.invoke('pty:kill', { workspaceId }),

  onPtyData: (callback: (workspaceId: string, data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, { workspaceId, data }: { workspaceId: string; data: string }) =>
      callback(workspaceId, data);
    ipcRenderer.on('pty:data', handler);
    return () => ipcRenderer.removeListener('pty:data', handler);
  },

  onPtyExit: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, { workspaceId }: { workspaceId: string }) =>
      callback(workspaceId);
    ipcRenderer.on('pty:exit', handler);
    return () => ipcRenderer.removeListener('pty:exit', handler);
  },

  onBranchChange: (callback: (workspacePath: string, branch: string | null) => void) => {
    const handler = (_: Electron.IpcRendererEvent, { workspacePath, branch }: { workspacePath: string; branch: string | null }) =>
      callback(workspacePath, branch);
    ipcRenderer.on('git:branch-changed', handler);
    return () => ipcRenderer.removeListener('git:branch-changed', handler);
  },

  onShortcut: (callback: (action: string, payload: Record<string, unknown>) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { action: string } & Record<string, unknown>) =>
      callback(data.action, data);
    ipcRenderer.on('shortcut', handler);
    return () => ipcRenderer.removeListener('shortcut', handler);
  },

  onUpdateAvailable: (callback: (version: string, url: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, { version, url }: { version: string; url: string }) =>
      callback(version, url);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
});
