import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import started from 'electron-squirrel-startup';
import * as pty from 'node-pty';

if (started) app.quit();

const execAsync = promisify(exec);

interface Workspace {
  id: string;
  name: string;
  path: string;
}

function getWorkspacesFile() {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function getTabsStateFile() {
  return path.join(app.getPath('userData'), 'tabs-state.json');
}

function getSettingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

const DEFAULT_SHELL = 'claude';

function loadSettings(): { fontFamily: string; fontSize: number; shell: string } {
  try {
    return JSON.parse(fs.readFileSync(getSettingsFile(), 'utf-8'));
  } catch {
    return { fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace', fontSize: 13, shell: DEFAULT_SHELL };
  }
}

function loadWorkspaces(): Workspace[] {
  try {
    return JSON.parse(fs.readFileSync(getWorkspacesFile(), 'utf-8'));
  } catch {
    return [];
  }
}

function saveWorkspaces(ws: Workspace[]) {
  fs.writeFileSync(getWorkspacesFile(), JSON.stringify(ws, null, 2));
}

async function getBranchForPath(workspacePath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
    return stdout.trim();
  } catch {
    return null;
  }
}

const ptyProcesses = new Map<string, pty.IPty>();
const branchWatchers = new Map<string, fs.FSWatcher>();

function watchBranch(workspacePath: string, win: BrowserWindow) {
  if (branchWatchers.has(workspacePath)) return;
  const headPath = path.join(workspacePath, '.git', 'HEAD');
  try {
    const watcher = fs.watch(headPath, async () => {
      const branch = await getBranchForPath(workspacePath);
      win.webContents.send('git:branch-changed', { workspacePath, branch });
    });
    branchWatchers.set(workspacePath, watcher);
  } catch {
    // not a git repo
  }
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Session',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('shortcut', { action: 'new-tab' }),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('shortcut', { action: 'close-tab' }),
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i): Electron.MenuItemConstructorOptions => ({
          label: `Switch to Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () =>
            BrowserWindow.getFocusedWindow()?.webContents.send('shortcut', { action: 'switch-tab', index: i }),
        })),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#141414',
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  win.webContents.on('did-finish-load', () => win.webContents.closeDevTools());

  return win;
};

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  ipcMain.handle('workspaces:get', () => loadWorkspaces());

  ipcMain.handle('tabs:get', () => {
    try {
      return JSON.parse(fs.readFileSync(getTabsStateFile(), 'utf-8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('tabs:save', (_, state: unknown) => {
    fs.writeFileSync(getTabsStateFile(), JSON.stringify(state, null, 2));
  });

  ipcMain.handle('workspaces:add', (_, { folderPath }: { folderPath: string }) => {
    const workspaces = loadWorkspaces();
    const workspace: Workspace = {
      id: Date.now().toString(),
      name: path.basename(folderPath),
      path: folderPath,
    };
    workspaces.push(workspace);
    saveWorkspaces(workspaces);
    return workspace;
  });

  ipcMain.handle('workspaces:remove', (_, { id }: { id: string }) => {
    const workspaces = loadWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (ws) {
      branchWatchers.get(ws.path)?.close();
      branchWatchers.delete(ws.path);
    }
    saveWorkspaces(workspaces.filter(w => w.id !== id));
    ptyProcesses.get(id)?.kill();
    ptyProcesses.delete(id);
  });

  ipcMain.handle('dialog:openFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('git:branch', async (event, { workspacePath }: { workspacePath: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) watchBranch(workspacePath, win);
    return getBranchForPath(workspacePath);
  });

  ipcMain.handle('settings:get', () => loadSettings());

  ipcMain.handle('settings:save', (_, settings: unknown) => {
    fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2));
  });

  ipcMain.handle('pty:create', (event, { workspaceId, workspacePath, cols, rows }: { workspaceId: string; workspacePath: string; cols: number; rows: number }) => {
    ptyProcesses.get(workspaceId)?.kill();

    const { shell } = loadSettings();
    const ptyProcess = pty.spawn(shell || DEFAULT_SHELL, [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: workspacePath,
      env: { ...process.env },
    });

    const win = BrowserWindow.fromWebContents(event.sender);

    ptyProcess.onData(data => win?.webContents.send('pty:data', { workspaceId, data }));
    ptyProcess.onExit(() => {
      ptyProcesses.delete(workspaceId);
      win?.webContents.send('pty:exit', { workspaceId });
    });

    ptyProcesses.set(workspaceId, ptyProcess);
  });

  ipcMain.handle('pty:write', (_, { workspaceId, data }: { workspaceId: string; data: string }) => {
    ptyProcesses.get(workspaceId)?.write(data);
  });

  ipcMain.handle('pty:resize', (_, { workspaceId, cols, rows }: { workspaceId: string; cols: number; rows: number }) => {
    ptyProcesses.get(workspaceId)?.resize(cols, rows);
  });

  ipcMain.handle('pty:kill', (_, { workspaceId }: { workspaceId: string }) => {
    ptyProcesses.get(workspaceId)?.kill();
    ptyProcesses.delete(workspaceId);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
