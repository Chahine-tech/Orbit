import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { get } from 'node:https';
import started from 'electron-squirrel-startup';
import * as pty from 'node-pty';

if (started) app.quit();

const execAsync = promisify(exec);

interface Workspace {
  id: string;
  name: string;
  path: string;
  color?: string;
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

function loadSettings(): { fontFamily: string; fontSize: number; shell: string; autoStart: boolean; sidebarCompact: boolean } {
  try {
    return JSON.parse(fs.readFileSync(getSettingsFile(), 'utf-8'));
  } catch {
    return { fontFamily: '"JetBrains Mono", "Menlo", "Monaco", monospace', fontSize: 13, shell: DEFAULT_SHELL, autoStart: false, sidebarCompact: false };
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

// Numeric semver comparison so "1.10.0" > "1.9.0" works correctly
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function checkForUpdates(win: BrowserWindow): void {
  get({
    hostname: 'api.github.com',
    path: '/repos/Chahine-tech/orbit/releases/latest',
    headers: { 'User-Agent': `Orbit/${app.getVersion()}` },
  }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return; }
    let raw = '';
    res.on('data', (chunk: Buffer) => { raw += chunk; });
    res.on('end', () => {
      try {
        const { tag_name, html_url } = JSON.parse(raw) as { tag_name: string; html_url: string };
        const latest = tag_name.replace(/^v/, '');
        const current = app.getVersion();
        if (latest && semverGt(latest, current)) {
          win.webContents.send('update:available', { version: latest, url: html_url });
        }
      } catch { /* ignore parse errors / missing releases */ }
    });
  }).on('error', () => { /* no network or repo not published yet */ });
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
  const iconPath = path.join(app.getAppPath(), 'src', 'assets', 'icon@1024.png');
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }
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
    icon: iconPath,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  win.webContents.on('did-finish-load', () => {
    win.webContents.closeDevTools();
    // Check for updates 5s after load so the UI is fully ready
    setTimeout(() => checkForUpdates(win), 5000);
  });

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

  ipcMain.handle('workspaces:discover', (_, { folderPath }: { folderPath: string }) => {
    const isRepo = fs.existsSync(path.join(folderPath, '.git'));
    if (isRepo) return { isRepo: true, repos: [] };
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const repos = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .filter(e => fs.existsSync(path.join(folderPath, e.name, '.git')))
        .map(e => ({ name: e.name, path: path.join(folderPath, e.name) }));
      return { isRepo: false, repos };
    } catch {
      return { isRepo: false, repos: [] };
    }
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const win = BrowserWindow.fromWebContents(event.sender)!;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:save-log', async (event, { content, filename }: { content: string; filename: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const win = BrowserWindow.fromWebContents(event.sender)!;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: filename,
      filters: [
        { name: 'Text', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md'] },
      ],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
    }
  });

  ipcMain.handle('shell:open-external', (_event, url: string) => shell.openExternal(url));

  ipcMain.handle('worktree:create', async (_event, { workspacePath, branch }: { workspacePath: string; branch: string }) => {
    const slug = branch.replace(/\//g, '-').replace(/[^a-zA-Z0-9._-]/g, '-');
    const worktreeDir = path.join(path.dirname(workspacePath), `${path.basename(workspacePath)}.worktrees`);
    const worktreePath = path.join(worktreeDir, slug);

    if (fs.existsSync(worktreePath)) {
      throw new Error(`A worktree already exists at that path. Choose a different branch name.`);
    }
    fs.mkdirSync(worktreeDir, { recursive: true });

    try {
      // Attempt to create a new branch
      await execAsync(`git worktree add "${worktreePath}" -b "${branch}"`, { cwd: workspacePath });
    } catch {
      try {
        // Branch already exists — just check it out in a new worktree
        await execAsync(`git worktree add "${worktreePath}" "${branch}"`, { cwd: workspacePath });
      } catch (e2) {
        const err = e2 as { stderr?: string; message?: string };
        throw new Error(err.stderr?.trim() || err.message || 'git worktree add failed');
      }
    }

    // Auto-provision: copy .env* files from parent workspace
    try {
      const envFiles = fs.readdirSync(workspacePath).filter(f => /^\.env/.test(f));
      for (const envFile of envFiles) {
        fs.copyFileSync(path.join(workspacePath, envFile), path.join(worktreePath, envFile));
      }
    } catch { /* non-fatal */ }

    // Auto-provision: run package manager install if package.json exists
    try {
      if (fs.existsSync(path.join(worktreePath, 'package.json'))) {
        const installCmd = fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml')) ? 'pnpm install'
          : fs.existsSync(path.join(workspacePath, 'yarn.lock')) ? 'yarn install'
          : 'npm install';
        await execAsync(installCmd, { cwd: worktreePath });
      }
    } catch { /* non-fatal — worktree is still usable without deps */ }

    return worktreePath;
  });

  ipcMain.handle('worktree:remove', async (_event, { worktreePath }: { worktreePath: string }) => {
    try {
      await execAsync(`git worktree remove "${worktreePath}" --force`);
    } catch {
      // Fallback: remove the directory directly
      try { fs.rmSync(worktreePath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  ipcMain.handle('worktree:confirm-remove', async (event, { branch }: { branch: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const win = BrowserWindow.fromWebContents(event.sender)!;
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Remove worktree', 'Keep worktree'],
      defaultId: 1,
      cancelId: 1,
      message: `Remove worktree for "${branch}"?`,
      detail: "The worktree directory and its uncommitted files will be deleted.",
    });
    return result.response === 0;
  });

  ipcMain.handle('git:branch', async (event, { workspacePath }: { workspacePath: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) watchBranch(workspacePath, win);
    return getBranchForPath(workspacePath);
  });

  ipcMain.handle('workspaces:reorder', (_, { ids }: { ids: string[] }) => {
    const workspaces = loadWorkspaces();
    const reordered = ids.map(id => workspaces.find(w => w.id === id)).filter((w): w is Workspace => !!w);
    saveWorkspaces(reordered);
  });

  ipcMain.handle('workspaces:set-color', (_, { id, color }: { id: string; color: string }) => {
    const workspaces = loadWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (ws) { ws.color = color; saveWorkspaces(workspaces); }
  });

  ipcMain.handle('settings:get', () => loadSettings());

  ipcMain.handle('settings:save', (_, settings: unknown) => {
    fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2));
  });

  ipcMain.handle('pty:create', (event, { workspaceId, workspacePath, cols, rows, extraArgs }: { workspaceId: string; workspacePath: string; cols: number; rows: number; extraArgs?: string[] }) => {
    ptyProcesses.get(workspaceId)?.kill();

    const { shell: configuredShell } = loadSettings();
    const ptyProcess = pty.spawn(configuredShell || DEFAULT_SHELL, extraArgs ?? [], {
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
