import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Terminal } from './components/Terminal';
import { SettingsPanel } from './components/SettingsPanel';
import { WorkspaceDiscovery } from './components/WorkspaceDiscovery';
import { DEFAULT_SETTINGS } from './types';
import type { Workspace, Tab, Settings } from './types';

// ─── State & reducer ─────────────────────────────────────────────────────────

type TabStatus = 'running' | 'exited';

type AppState = {
  workspaces: Workspace[];
  activeId: string | null;
  tabs: Record<string, Tab[]>;
  activeTabId: Record<string, string>;
  mountedIds: Set<string>;
  editingTabId: string | null;
  branches: Record<string, string | null>;
  tabStatus: Record<string, TabStatus>;
};

type Action =
  | { type: 'init'; workspaces: Workspace[]; persisted: { activeId: string | null; tabs: Record<string, Tab[]>; activeTabId: Record<string, string> } | null; autoStart: boolean }
  | { type: 'workspace-added'; workspace: Workspace; firstTab: Tab }
  | { type: 'workspace-removed'; id: string }
  | { type: 'workspace-selected'; id: string; newTab?: Tab }
  | { type: 'workspaces-reordered'; workspaces: Workspace[] }
  | { type: 'workspace-color'; id: string; color: string }
  | { type: 'tab-added'; workspaceId: string; tab: Tab }
  | { type: 'tab-closed'; workspaceId: string; tabId: string }
  | { type: 'tab-renamed'; workspaceId: string; tabId: string; label: string }
  | { type: 'tab-restarted'; workspaceId: string; tabId: string }
  | { type: 'tab-split'; workspaceId: string; tabId: string; direction: 'horizontal' | 'vertical' }
  | { type: 'tab-unsplit'; workspaceId: string; tabId: string }
  | { type: 'tab-split-restarted'; workspaceId: string; tabId: string }
  | { type: 'tab-status'; tabId: string; status: TabStatus }
  | { type: 'editing-tab'; tabId: string | null }
  | { type: 'active-tab'; workspaceId: string; tabId: string }
  | { type: 'branch'; path: string; branch: string | null };

const initial: AppState = {
  workspaces: [],
  activeId: null,
  tabs: {},
  activeTabId: {},
  mountedIds: new Set(),
  editingTabId: null,
  branches: {},
  tabStatus: {},
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'init': {
      const p = action.persisted;
      if (!p) return { ...state, workspaces: action.workspaces };
      const mountedIds = p.activeId ? new Set([p.activeId]) : new Set<string>();
      if (action.autoStart) {
        Object.keys(p.tabs).forEach(id => {
          if ((p.tabs[id]?.length ?? 0) > 0) mountedIds.add(id);
        });
      }
      return {
        ...state,
        workspaces: action.workspaces,
        tabs: p.tabs,
        activeTabId: p.activeTabId,
        activeId: p.activeId,
        mountedIds,
      };
    }
    case 'workspace-added':
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        activeId: action.workspace.id,
        mountedIds: new Set(state.mountedIds).add(action.workspace.id),
        tabs: { ...state.tabs, [action.workspace.id]: [action.firstTab] },
        activeTabId: { ...state.activeTabId, [action.workspace.id]: action.firstTab.id },
      };
    case 'workspace-removed': {
      const tabs = { ...state.tabs };
      const activeTabId = { ...state.activeTabId };
      const mountedIds = new Set(state.mountedIds);
      const tabStatus = { ...state.tabStatus };
      (tabs[action.id] ?? []).forEach(t => {
        delete tabStatus[t.id];
        if (t.splitSessionId) delete tabStatus[t.splitSessionId];
      });
      delete tabs[action.id];
      delete activeTabId[action.id];
      mountedIds.delete(action.id);
      return {
        ...state,
        workspaces: state.workspaces.filter(w => w.id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
        tabs, activeTabId, mountedIds, tabStatus,
      };
    }
    case 'workspaces-reordered':
      return { ...state, workspaces: action.workspaces };
    case 'workspace-color':
      return {
        ...state,
        workspaces: state.workspaces.map(w => w.id === action.id ? { ...w, color: action.color } : w),
      };
    case 'workspace-selected': {
      const mountedIds = new Set(state.mountedIds).add(action.id);
      if (!action.newTab) return { ...state, activeId: action.id, mountedIds };
      return {
        ...state,
        activeId: action.id,
        mountedIds,
        tabs: { ...state.tabs, [action.id]: [action.newTab] },
        activeTabId: { ...state.activeTabId, [action.id]: action.newTab.id },
      };
    }
    case 'tab-added': {
      const existing = state.tabs[action.workspaceId] ?? [];
      return {
        ...state,
        tabs: { ...state.tabs, [action.workspaceId]: [...existing, action.tab] },
        activeTabId: { ...state.activeTabId, [action.workspaceId]: action.tab.id },
      };
    }
    case 'tab-closed': {
      const closedTab = (state.tabs[action.workspaceId] ?? []).find(t => t.id === action.tabId);
      const remaining = (state.tabs[action.workspaceId] ?? []).filter(t => t.id !== action.tabId);
      const tabStatus = { ...state.tabStatus };
      delete tabStatus[action.tabId];
      if (closedTab?.splitSessionId) delete tabStatus[closedTab.splitSessionId];
      if (remaining.length === 0) {
        const tabs = { ...state.tabs };
        const activeTabId = { ...state.activeTabId };
        const mountedIds = new Set(state.mountedIds);
        delete tabs[action.workspaceId];
        delete activeTabId[action.workspaceId];
        mountedIds.delete(action.workspaceId);
        return { ...state, activeId: null, tabs, activeTabId, mountedIds, tabStatus };
      }
      const activeTabId = { ...state.activeTabId };
      if (activeTabId[action.workspaceId] === action.tabId) {
        activeTabId[action.workspaceId] = remaining[remaining.length - 1].id;
      }
      return { ...state, tabs: { ...state.tabs, [action.workspaceId]: remaining }, activeTabId, tabStatus };
    }
    case 'tab-renamed':
      return {
        ...state,
        editingTabId: null,
        tabs: {
          ...state.tabs,
          [action.workspaceId]: (state.tabs[action.workspaceId] ?? []).map(t =>
            t.id === action.tabId ? { ...t, label: action.label } : t
          ),
        },
      };
    case 'tab-restarted':
      return {
        ...state,
        tabStatus: { ...state.tabStatus, [action.tabId]: 'running' },
        tabs: {
          ...state.tabs,
          [action.workspaceId]: (state.tabs[action.workspaceId] ?? []).map(t =>
            t.id === action.tabId ? { ...t, restartCount: (t.restartCount ?? 0) + 1 } : t
          ),
        },
      };
    case 'tab-split':
      return {
        ...state,
        tabs: {
          ...state.tabs,
          [action.workspaceId]: (state.tabs[action.workspaceId] ?? []).map(t =>
            t.id === action.tabId
              ? { ...t, splitSessionId: `${t.id}-split`, splitDirection: action.direction, splitRestartCount: 0 }
              : t
          ),
        },
      };
    case 'tab-unsplit': {
      const existingTab = (state.tabs[action.workspaceId] ?? []).find(t => t.id === action.tabId);
      const tabStatus = { ...state.tabStatus };
      if (existingTab?.splitSessionId) delete tabStatus[existingTab.splitSessionId];
      return {
        ...state,
        tabStatus,
        tabs: {
          ...state.tabs,
          [action.workspaceId]: (state.tabs[action.workspaceId] ?? []).map(t => {
            if (t.id !== action.tabId) return t;
            return { id: t.id, workspaceId: t.workspaceId, label: t.label, restartCount: t.restartCount };
          }),
        },
      };
    }
    case 'tab-split-restarted': {
      const splitId = (state.tabs[action.workspaceId] ?? []).find(t => t.id === action.tabId)?.splitSessionId;
      const tabStatus = splitId ? { ...state.tabStatus, [splitId]: 'running' as TabStatus } : state.tabStatus;
      return {
        ...state,
        tabStatus,
        tabs: {
          ...state.tabs,
          [action.workspaceId]: (state.tabs[action.workspaceId] ?? []).map(t =>
            t.id === action.tabId ? { ...t, splitRestartCount: (t.splitRestartCount ?? 0) + 1 } : t
          ),
        },
      };
    }
    case 'tab-status':
      return { ...state, tabStatus: { ...state.tabStatus, [action.tabId]: action.status } };
    case 'editing-tab':
      return { ...state, editingTabId: action.tabId };
    case 'active-tab':
      return { ...state, activeTabId: { ...state.activeTabId, [action.workspaceId]: action.tabId } };
    case 'branch':
      return { ...state, branches: { ...state.branches, [action.path]: action.branch } };
    default:
      return state;
  }
}

function newTab(workspaceId: string, existing: Tab[]): Tab {
  return { id: `${workspaceId}-${Date.now()}`, workspaceId, label: `Session ${existing.length + 1}`, restartCount: 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const { workspaces, activeId, tabs, activeTabId, mountedIds, editingTabId, branches, tabStatus } = state;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null);
  const [worktreeOpen, setWorktreeOpen] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState('');
  const [worktreeCreating, setWorktreeCreating] = useState(false);
  const [worktreeError, setWorktreeError] = useState('');
  const [discoveryState, setDiscoveryState] = useState<{ folderPath: string; repos: Array<{ name: string; path: string }> } | null>(null);

  // Per-session output log for export (capped at 5 MB per session)
  const logBuffer = useRef<Record<string, string>>({});

  // Activity pulse: track last PTY data timestamp per session (ref = no re-render on every keystroke)
  const lastActiveRef = useRef<Record<string, number>>({});
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

  // Context compaction: track sessions where Claude auto-compacted context
  const [contextCompacted, setContextCompacted] = useState<Set<string>>(new Set());

  // Pending resume args: consumed once by Terminal effect on next restart
  const pendingResumeArgsRef = useRef<Record<string, string[]>>({});
  const getAndClearResumeArgs = useCallback((tabId: string): string[] => {
    const args = pendingResumeArgsRef.current[tabId] ?? [];
    delete pendingResumeArgsRef.current[tabId];
    return args;
  }, []);

  // stateRef: avoids stale closures in long-lived subscriptions and intervals
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    Promise.all([
      window.api.getWorkspaces(),
      window.api.getTabsState(),
      window.api.getSettings(),
    ]).then(([wsList, persisted, savedSettings]) => {
      const merged = { ...DEFAULT_SETTINGS, ...savedSettings };
      setSettings(merged);
      dispatch({ type: 'init', workspaces: wsList, persisted, autoStart: merged.autoStart });
    });
  }, []);

  // Persist tabs state with debounce
  useEffect(() => {
    const id = setTimeout(() => {
      window.api.saveTabsState({ activeId, tabs, activeTabId });
    }, 500);
    return () => clearTimeout(id);
  }, [tabs, activeTabId, activeId]);

  useEffect(() => {
    return window.api.onBranchChange((workspacePath, branch) => {
      dispatch({ type: 'branch', path: workspacePath, branch });
    });
  }, []);

  // Only the active workspace's path matters — workspace path is immutable once added
  const activePath = workspaces.find(w => w.id === activeId)?.path ?? null;
  useEffect(() => {
    if (!activePath) return;
    window.api.getBranch(activePath).then(branch => {
      dispatch({ type: 'branch', path: activePath, branch });
    });
  }, [activeId, activePath]);

  // Global PTY exit → update tab status badge
  useEffect(() => {
    return window.api.onPtyExit(tabId => {
      dispatch({ type: 'tab-status', tabId, status: 'exited' });
    });
  }, []);

  // Accumulate terminal output for session log export + track activity timestamps + detect context compaction
  useEffect(() => {
    return window.api.onPtyData((sessionId, data) => {
      const prev = logBuffer.current[sessionId] ?? '';
      if (prev.length < 5 * 1024 * 1024) {
        logBuffer.current[sessionId] = prev + data;
      }
      lastActiveRef.current[sessionId] = Date.now();

      // Detect Claude Code auto-compaction notice
      // eslint-disable-next-line no-control-regex
      const text = data.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '');
      if (/auto.?compact|compacting.*context|context.*compact/i.test(text)) {
        setContextCompacted(prev => prev.has(sessionId) ? prev : new Set([...prev, sessionId]));
      }
    });
  }, []);

  // Derive active workspace IDs at 500ms cadence (max 2 re-renders/s regardless of output volume)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const next = new Set<string>();
      Object.entries(lastActiveRef.current).forEach(([sessionId, ts]) => {
        if (now - ts > 2000) return;
        const wsId = Object.keys(stateRef.current.tabs).find(wid =>
          stateRef.current.tabs[wid]?.some(t => t.id === sessionId || t.splitSessionId === sessionId)
        );
        if (wsId) next.add(wsId);
      });
      setActiveSessions(prev => {
        if (prev.size === next.size && [...next].every(id => prev.has(id))) return prev;
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Update notification from main process
  useEffect(() => {
    return window.api.onUpdateAvailable((version, url) => {
      setUpdateInfo({ version, url });
    });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddTab = (workspaceId: string) => {
    dispatch({ type: 'tab-added', workspaceId, tab: newTab(workspaceId, tabs[workspaceId] ?? []) });
  };

  const handleCloseTab = async (workspaceId: string, tabId: string) => {
    const tab = tabs[workspaceId]?.find(t => t.id === tabId);

    if (tab?.worktreePath && tab.worktreeBranch) {
      const shouldRemove = await window.api.confirmRemoveWorktree(tab.worktreeBranch);
      if (shouldRemove) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await window.api.removeWorktree(tab.worktreePath).catch(() => {});
      }
    }

    await window.api.ptyKill(tabId);
    if (tab?.splitSessionId) await window.api.ptyKill(tab.splitSessionId);
    dispatch({ type: 'tab-closed', workspaceId, tabId });
  };

  const handleAddWorktreeTab = async () => {
    if (!activeWorkspace) return;
    const branch = worktreeBranch.trim();
    if (!branch) return;
    setWorktreeCreating(true);
    setWorktreeError('');
    try {
      const worktreePath = await window.api.createWorktree(activeWorkspace.path, branch);
      const tab: Tab = {
        id: `${activeWorkspace.id}-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        label: branch,
        restartCount: 0,
        worktreePath,
        worktreeBranch: branch,
      };
      dispatch({ type: 'tab-added', workspaceId: activeWorkspace.id, tab });
      setWorktreeOpen(false);
      setWorktreeBranch('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWorktreeError(
        msg.includes('not a git') ? 'This workspace is not a git repository.' :
        msg.includes('already') ? 'Branch or worktree already exists.' :
        'Failed to create worktree. Check that the branch name is valid.'
      );
    } finally {
      setWorktreeCreating(false);
    }
  };

  const handleRestartTab = (workspaceId: string, tabId: string) => {
    setContextCompacted(prev => { const next = new Set(prev); next.delete(tabId); return next; });
    dispatch({ type: 'tab-restarted', workspaceId, tabId });
  };

  const handleResumeTab = (workspaceId: string, tabId: string) => {
    pendingResumeArgsRef.current[tabId] = ['--continue'];
    setContextCompacted(prev => { const next = new Set(prev); next.delete(tabId); return next; });
    dispatch({ type: 'tab-restarted', workspaceId, tabId });
  };

  const handleSplitTab = (workspaceId: string, tabId: string) => {
    dispatch({ type: 'tab-split', workspaceId, tabId, direction: 'horizontal' });
  };

  const handleUnsplitTab = async (workspaceId: string, tabId: string) => {
    const tab = tabs[workspaceId]?.find(t => t.id === tabId);
    if (tab?.splitSessionId) await window.api.ptyKill(tab.splitSessionId);
    dispatch({ type: 'tab-unsplit', workspaceId, tabId });
  };

  const handleRestartSplit = (workspaceId: string, tabId: string) => {
    dispatch({ type: 'tab-split-restarted', workspaceId, tabId });
  };

  const handleExportLog = async (workspaceId: string, tabId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    const tab = (tabs[workspaceId] ?? []).find(t => t.id === tabId);
    const raw = logBuffer.current[tabId] ?? '';
    /* eslint-disable no-control-regex */
    const clean = raw
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1B[()][0-9A-Za-z]/g, '');
    /* eslint-enable no-control-regex */
    const cleanFinal = clean
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const filename = `${ws?.name ?? 'session'}-${tab?.label ?? 'log'}.txt`;
    await window.api.saveLog(cleanFinal, filename);
  };

  const handleSelect = (id: string) => {
    const hasTabs = (tabs[id]?.length ?? 0) > 0;
    dispatch({ type: 'workspace-selected', id, ...(!hasTabs && { newTab: newTab(id, []) }) });
  };

  const handleAdd = async () => {
    const folderPath = await window.api.openFolderDialog();
    if (!folderPath) return;
    const discovery = await window.api.discoverWorkspaces(folderPath);
    if (discovery.isRepo || discovery.repos.length === 0) {
      const workspace = await window.api.addWorkspace(folderPath);
      dispatch({ type: 'workspace-added', workspace, firstTab: newTab(workspace.id, []) });
    } else {
      setDiscoveryState({ folderPath, repos: discovery.repos });
    }
  };

  const handleDiscoveryAdd = async (selected: Array<{ name: string; path: string }>) => {
    setDiscoveryState(null);
    for (const repo of selected) {
      const workspace = await window.api.addWorkspace(repo.path);
      dispatch({ type: 'workspace-added', workspace, firstTab: newTab(workspace.id, []) });
    }
  };

  const handleDiscoveryAddParent = async () => {
    if (!discoveryState) return;
    setDiscoveryState(null);
    const workspace = await window.api.addWorkspace(discoveryState.folderPath);
    dispatch({ type: 'workspace-added', workspace, firstTab: newTab(workspace.id, []) });
  };

  const handleRemove = async (id: string) => {
    await Promise.all(
      (tabs[id] ?? []).flatMap(tab => {
        const kills: Promise<void>[] = [window.api.ptyKill(tab.id)];
        if (tab.splitSessionId) kills.push(window.api.ptyKill(tab.splitSessionId));
        return kills;
      })
    );
    await window.api.removeWorkspace(id);
    dispatch({ type: 'workspace-removed', id });
  };

  const handleReorder = async (fromId: string, toId: string) => {
    const fromIdx = workspaces.findIndex(w => w.id === fromId);
    const toIdx = workspaces.findIndex(w => w.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...workspaces];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    dispatch({ type: 'workspaces-reordered', workspaces: reordered });
    await window.api.reorderWorkspaces(reordered.map(w => w.id));
  };

  const handleSetColor = async (id: string, color: string) => {
    dispatch({ type: 'workspace-color', id, color });
    await window.api.setWorkspaceColor(id, color);
  };

  const handleSettingsChange = (updated: Settings) => {
    setSettings(updated);
    window.api.saveSettings(updated);
  };

  // Keyboard shortcuts
  useEffect(() => {
    return window.api.onShortcut((action, payload) => {
      const { activeId, activeTabId, tabs } = stateRef.current;
      if (!activeId) return;
      if (action === 'new-tab') {
        dispatch({ type: 'tab-added', workspaceId: activeId, tab: newTab(activeId, tabs[activeId] ?? []) });
      } else if (action === 'close-tab') {
        const tabId = activeTabId[activeId];
        const tab = tabs[activeId]?.find(t => t.id === tabId);
        if (tabId) {
          window.api.ptyKill(tabId);
          if (tab?.splitSessionId) window.api.ptyKill(tab.splitSessionId);
          dispatch({ type: 'tab-closed', workspaceId: activeId, tabId });
        }
      } else if (action === 'switch-tab') {
        const idx = payload.index as number;
        const tabList = tabs[activeId] ?? [];
        if (tabList[idx]) dispatch({ type: 'active-tab', workspaceId: activeId, tabId: tabList[idx].id });
      }
    });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeWorkspace = workspaces.find(w => w.id === activeId);
  const activeWorkspaceIds = activeSessions.size > 0
    ? new Set(workspaces.filter(ws => (tabs[ws.id] ?? []).some(t =>
        activeSessions.has(t.id) || (t.splitSessionId ? activeSessions.has(t.splitSessionId) : false)
      )).map(ws => ws.id))
    : new Set<string>();
  const activeTab = activeWorkspace
    ? (tabs[activeWorkspace.id] ?? []).find(t => t.id === activeTabId[activeWorkspace.id])
    : undefined;
  const connectedIds = new Set(Object.keys(tabs).filter(id => (tabs[id]?.length ?? 0) > 0));
  const activeBranch = activeWorkspace ? branches[activeWorkspace.path] : null;

  // Broadcast-aware input handler: routes keystrokes to all sessions when active
  const makeOnInput = (wsId: string, sessionId: string) => (data: string) => {
    if (broadcastMode) {
      const allSessions = (tabs[wsId] ?? []).flatMap(t =>
        t.splitSessionId ? [t.id, t.splitSessionId] : [t.id]
      );
      allSessions.forEach(id => window.api.ptyWrite(id, data));
    } else {
      window.api.ptyWrite(sessionId, data);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces}
        activeId={activeId}
        connectedIds={connectedIds}
        activeIds={activeWorkspaceIds}
        compact={settings.sidebarCompact}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onReorder={handleReorder}
        onSetColor={handleSetColor}
        onSettings={() => setSettingsOpen(true)}
        onToggleCompact={() => handleSettingsChange({ ...settings, sidebarCompact: !settings.sidebarCompact })}
      />
      <div className="main">
        {updateInfo && (
          <div className="update-banner">
            <span>✦ Orbit {updateInfo.version} is available</span>
            <button type="button" className="update-link" onClick={() => window.api.openExternal(updateInfo.url)}>
              Download ↗
            </button>
            <button type="button" className="update-dismiss" onClick={() => setUpdateInfo(null)}>✕</button>
          </div>
        )}
        {activeWorkspace && (
          <>
            <div className="workspace-header">
              <span className="header-path">📁 {activeWorkspace.path}</span>
              {activeBranch && <span className="header-branch">⎇ {activeBranch}</span>}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="icon-btn"
                title="Export session log"
                style={{ fontSize: 11 }}
                onClick={() => handleExportLog(activeWorkspace.id, activeTabId[activeWorkspace.id] ?? '')}
              >
                ↓
              </button>
              <button
                type="button"
                className={`icon-btn${broadcastMode ? ' broadcast-active' : ''}`}
                title={broadcastMode ? 'Broadcast ON — input goes to all sessions' : 'Broadcast: send input to all sessions'}
                onClick={() => setBroadcastMode(b => !b)}
              >
                ⊕
              </button>
              <button
                type="button"
                className={`icon-btn${activeTab?.splitSessionId ? ' split-active' : ''}`}
                title={activeTab?.splitSessionId ? 'Close split pane' : 'Split pane'}
                onClick={() => {
                  if (activeTab?.splitSessionId) {
                    handleUnsplitTab(activeWorkspace.id, activeTab.id);
                  } else if (activeTab) {
                    handleSplitTab(activeWorkspace.id, activeTab.id);
                  }
                }}
              >
                ⊞
              </button>
            </div>
            <TabBar
              tabs={tabs[activeWorkspace.id] ?? []}
              activeTabId={activeTabId[activeWorkspace.id] ?? ''}
              editingTabId={editingTabId}
              tabStatus={tabStatus}
              compactedSessions={contextCompacted}
              onSelect={tabId => dispatch({ type: 'active-tab', workspaceId: activeWorkspace.id, tabId })}
              onAdd={() => handleAddTab(activeWorkspace.id)}
              onAddWorktree={() => { setWorktreeOpen(true); setWorktreeError(''); setWorktreeBranch(''); }}
              onClose={tabId => handleCloseTab(activeWorkspace.id, tabId)}
              onStartEdit={tabId => dispatch({ type: 'editing-tab', tabId })}
              onRename={(tabId, label) => dispatch({ type: 'tab-renamed', workspaceId: activeWorkspace.id, tabId, label })}
            />
          </>
        )}
        <div className="terminal-area">
          {!activeWorkspace && (
            <div className="onboarding">
              <div className="onboarding-logo">◉</div>
              <h1 className="onboarding-title">Orbit</h1>
              <p className="onboarding-subtitle">
                Isolated AI coding sessions,<br />one workspace per project.
              </p>
              <button type="button" className="onboarding-add-btn" onClick={handleAdd}>
                + Add your first workspace
              </button>
              <div className="onboarding-tools">
                Works with&nbsp;
                <code>claude</code> · <code>codex</code> · <code>aider</code> · <code>gemini</code>
                <span className="onboarding-hint">Change command in ⚙ Settings</span>
              </div>
              <div className="onboarding-shortcuts">
                <kbd>⌘T</kbd> new tab
                <span className="dot">·</span>
                <kbd>⌘W</kbd> close
                <span className="dot">·</span>
                <kbd>⌘1–9</kbd> switch
              </div>
            </div>
          )}
          {workspaces.flatMap(ws =>
            mountedIds.has(ws.id)
              ? (tabs[ws.id] ?? []).map(tab => {
                  const isThisTabActive = ws.id === activeId && tab.id === activeTabId[ws.id];
                  if (tab.splitSessionId) {
                    return (
                      <div
                        key={tab.id}
                        className="pane-container pane-horizontal"
                        style={{ display: isThisTabActive ? 'flex' : 'none', height: '100%', width: '100%' }}
                      >
                        <Terminal
                          key={tab.id}
                          sessionId={tab.id}
                          workspacePath={tab.worktreePath ?? ws.path}
                          hidden={false}
                          fontFamily={settings.fontFamily}
                          fontSize={settings.fontSize}
                          restartCount={tab.restartCount ?? 0}
                          exited={tabStatus[tab.id] === 'exited'}
                          compacted={contextCompacted.has(tab.id)}
                          onRestart={() => handleRestartTab(ws.id, tab.id)}
                          onResume={() => handleResumeTab(ws.id, tab.id)}
                          onDismissCompaction={() => setContextCompacted(prev => { const next = new Set(prev); next.delete(tab.id); return next; })}
                          onInput={makeOnInput(ws.id, tab.id)}
                          getResumeArgs={() => getAndClearResumeArgs(tab.id)}
                        />
                        <div className="pane-divider" />
                        <div className="pane-secondary">
                          <button
                            type="button"
                            className="pane-close-btn"
                            title="Close split"
                            onClick={() => handleUnsplitTab(ws.id, tab.id)}
                          >
                            ✕
                          </button>
                          <Terminal
                            key={tab.splitSessionId}
                            sessionId={tab.splitSessionId}
                            workspacePath={tab.worktreePath ?? ws.path}
                            hidden={false}
                            fontFamily={settings.fontFamily}
                            fontSize={settings.fontSize}
                            restartCount={tab.splitRestartCount ?? 0}
                            exited={tabStatus[tab.splitSessionId] === 'exited'}
                            compacted={contextCompacted.has(tab.splitSessionId)}
                            onRestart={() => handleRestartSplit(ws.id, tab.id)}
                            onResume={() => handleResumeTab(ws.id, tab.id)}
                            onDismissCompaction={() => setContextCompacted(prev => { const next = new Set(prev); next.delete(tab.splitSessionId!); return next; })}
                            onInput={makeOnInput(ws.id, tab.splitSessionId!)}
                            getResumeArgs={() => getAndClearResumeArgs(tab.splitSessionId!)}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Terminal
                      key={tab.id}
                      sessionId={tab.id}
                      workspacePath={tab.worktreePath ?? ws.path}
                      hidden={!isThisTabActive}
                      fontFamily={settings.fontFamily}
                      fontSize={settings.fontSize}
                      restartCount={tab.restartCount ?? 0}
                      exited={tabStatus[tab.id] === 'exited'}
                      compacted={contextCompacted.has(tab.id)}
                      onRestart={() => handleRestartTab(ws.id, tab.id)}
                      onResume={() => handleResumeTab(ws.id, tab.id)}
                      onDismissCompaction={() => setContextCompacted(prev => { const next = new Set(prev); next.delete(tab.id); return next; })}
                      onInput={makeOnInput(ws.id, tab.id)}
                      getResumeArgs={() => getAndClearResumeArgs(tab.id)}
                    />
                  );
                })
              : []
          )}
        </div>
      </div>
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={handleSettingsChange}
        />
      )}
      {discoveryState && (
        <WorkspaceDiscovery
          folderPath={discoveryState.folderPath}
          repos={discoveryState.repos}
          onAdd={handleDiscoveryAdd}
          onAddParent={handleDiscoveryAddParent}
          onCancel={() => setDiscoveryState(null)}
        />
      )}
      {worktreeOpen && activeWorkspace && (
        <div
          className="worktree-overlay"
          onClick={() => { setWorktreeOpen(false); setWorktreeError(''); }}
        >
          <div className="worktree-dialog" onClick={e => e.stopPropagation()}>
            <div className="worktree-dialog-title">⎇ New worktree tab</div>
            <div className="worktree-dialog-subtitle">
              Creates <code>{activeWorkspace.path.split('/').pop()}.worktrees/&lt;branch&gt;</code>, copies <code>.env</code> files, and runs install if needed.
            </div>
            <WorktreeInput
              value={worktreeBranch}
              onChange={setWorktreeBranch}
              onSubmit={handleAddWorktreeTab}
              onCancel={() => { setWorktreeOpen(false); setWorktreeError(''); }}
            />
            {worktreeError && <p className="worktree-error">{worktreeError}</p>}
            <div className="worktree-dialog-actions">
              <button
                type="button"
                className="worktree-cancel-btn"
                onClick={() => { setWorktreeOpen(false); setWorktreeError(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="worktree-create-btn"
                disabled={!worktreeBranch.trim() || worktreeCreating}
                onClick={handleAddWorktreeTab}
              >
                {worktreeCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component so useEffect for focus doesn't re-run on parent re-renders
function WorktreeInput({ value, onChange, onSubmit, onCancel }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <input
      ref={ref}
      className="worktree-input"
      placeholder="feat/my-feature"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSubmit();
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}
