import { useReducer, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Terminal } from './components/Terminal';
import { SettingsPanel } from './components/SettingsPanel';
import type { Workspace, Tab, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

// ─── State shape & reducer ────────────────────────────────────────────────────

type AppState = {
  workspaces: Workspace[];
  activeId: string | null;
  tabs: Record<string, Tab[]>;
  activeTabId: Record<string, string>;
  mountedIds: Set<string>;
  editingTabId: string | null;
  branches: Record<string, string | null>;
};

type Action =
  | { type: 'init'; workspaces: Workspace[]; persisted: { activeId: string | null; tabs: Record<string, Tab[]>; activeTabId: Record<string, string> } | null }
  | { type: 'workspace-added'; workspace: Workspace; firstTab: Tab }
  | { type: 'workspace-removed'; id: string }
  | { type: 'workspace-selected'; id: string; newTab?: Tab }
  | { type: 'tab-added'; workspaceId: string; tab: Tab }
  | { type: 'tab-closed'; workspaceId: string; tabId: string }
  | { type: 'tab-renamed'; workspaceId: string; tabId: string; label: string }
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
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'init': {
      const p = action.persisted;
      return {
        ...state,
        workspaces: action.workspaces,
        ...(p && {
          tabs: p.tabs,
          activeTabId: p.activeTabId,
          activeId: p.activeId,
          mountedIds: p.activeId ? new Set([p.activeId]) : new Set<string>(),
        }),
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
      delete tabs[action.id];
      delete activeTabId[action.id];
      mountedIds.delete(action.id);
      return {
        ...state,
        workspaces: state.workspaces.filter(w => w.id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
        tabs,
        activeTabId,
        mountedIds,
      };
    }
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
      const remaining = (state.tabs[action.workspaceId] ?? []).filter(t => t.id !== action.tabId);
      if (remaining.length === 0) {
        const tabs = { ...state.tabs };
        const activeTabId = { ...state.activeTabId };
        const mountedIds = new Set(state.mountedIds);
        delete tabs[action.workspaceId];
        delete activeTabId[action.workspaceId];
        mountedIds.delete(action.workspaceId);
        return { ...state, activeId: null, tabs, activeTabId, mountedIds };
      }
      const activeTabId = { ...state.activeTabId };
      if (activeTabId[action.workspaceId] === action.tabId) {
        activeTabId[action.workspaceId] = remaining[remaining.length - 1].id;
      }
      return { ...state, tabs: { ...state.tabs, [action.workspaceId]: remaining }, activeTabId };
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

// Moved to module scope: pure function with no local state dependency
function newTab(workspaceId: string, existing: Tab[]): Tab {
  return { id: `${workspaceId}-${Date.now()}`, workspaceId, label: `Session ${existing.length + 1}` };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const { workspaces, activeId, tabs, activeTabId, mountedIds, editingTabId, branches } = state;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      window.api.getWorkspaces(),
      window.api.getTabsState(),
      window.api.getSettings(),
    ]).then(([wsList, persisted, savedSettings]) => {
      dispatch({ type: 'init', workspaces: wsList, persisted });
      if (savedSettings) setSettings(savedSettings);
    });
  }, []);

  // Debounced persist — clearTimeout in cleanup so the timer never fires after unmount
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

  useEffect(() => {
    if (!activeId) return;
    const ws = workspaces.find(w => w.id === activeId);
    if (!ws) return;
    window.api.getBranch(ws.path).then(branch => {
      dispatch({ type: 'branch', path: ws.path, branch });
    });
  }, [activeId, workspaces]);

  const handleAddTab = (workspaceId: string) => {
    dispatch({ type: 'tab-added', workspaceId, tab: newTab(workspaceId, tabs[workspaceId] ?? []) });
  };

  const handleCloseTab = async (workspaceId: string, tabId: string) => {
    await window.api.ptyKill(tabId);
    dispatch({ type: 'tab-closed', workspaceId, tabId });
  };

  const handleSelect = (id: string) => {
    const hasTabs = (tabs[id]?.length ?? 0) > 0;
    dispatch({ type: 'workspace-selected', id, ...(!hasTabs && { newTab: newTab(id, []) }) });
  };

  const handleAdd = async () => {
    const folderPath = await window.api.openFolderDialog();
    if (!folderPath) return;
    const workspace = await window.api.addWorkspace(folderPath);
    dispatch({ type: 'workspace-added', workspace, firstTab: newTab(workspace.id, []) });
  };

  const handleSettingsChange = (updated: Settings) => {
    setSettings(updated);
    window.api.saveSettings(updated);
  };

  const handleRemove = async (id: string) => {
    // Run all ptyKill calls concurrently instead of sequentially
    await Promise.all((tabs[id] ?? []).map(tab => window.api.ptyKill(tab.id)));
    await window.api.removeWorkspace(id);
    dispatch({ type: 'workspace-removed', id });
  };

  // Stable ref so the IPC subscription (registered once on mount) always reads current state
  // without needing to re-subscribe on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return window.api.onShortcut((action, payload) => {
      const { activeId, activeTabId, tabs } = stateRef.current;
      if (!activeId) return;
      if (action === 'new-tab') {
        dispatch({ type: 'tab-added', workspaceId: activeId, tab: newTab(activeId, tabs[activeId] ?? []) });
      } else if (action === 'close-tab') {
        const tabId = activeTabId[activeId];
        if (tabId) {
          window.api.ptyKill(tabId);
          dispatch({ type: 'tab-closed', workspaceId: activeId, tabId });
        }
      } else if (action === 'switch-tab') {
        const idx = payload.index as number;
        const tabList = tabs[activeId] ?? [];
        if (tabList[idx]) dispatch({ type: 'active-tab', workspaceId: activeId, tabId: tabList[idx].id });
      }
    });
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeId);
  const connectedIds = new Set(Object.keys(tabs).filter(id => (tabs[id]?.length ?? 0) > 0));
  const activeBranch = activeWorkspace ? branches[activeWorkspace.path] : null;

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces}
        activeId={activeId}
        connectedIds={connectedIds}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="main">
        {activeWorkspace && (
          <>
            <div className="workspace-header">
              <span className="header-path">📁 {activeWorkspace.path}</span>
              {activeBranch && <span className="header-branch">⎇ {activeBranch}</span>}
            </div>
            <TabBar
              tabs={tabs[activeWorkspace.id] ?? []}
              activeTabId={activeTabId[activeWorkspace.id] ?? ''}
              editingTabId={editingTabId}
              onSelect={tabId => dispatch({ type: 'active-tab', workspaceId: activeWorkspace.id, tabId })}
              onAdd={() => handleAddTab(activeWorkspace.id)}
              onClose={tabId => handleCloseTab(activeWorkspace.id, tabId)}
              onStartEdit={tabId => dispatch({ type: 'editing-tab', tabId })}
              onRename={(tabId, label) => dispatch({ type: 'tab-renamed', workspaceId: activeWorkspace.id, tabId, label })}
            />
          </>
        )}
        <div className="terminal-area">
          {!activeWorkspace && (
            <div className="empty-state">
              <div className="empty-icon">⌨️</div>
              <p>Select a workspace to get started</p>
              <button type="button" className="empty-add-btn" onClick={handleAdd}>+ Add a workspace</button>
            </div>
          )}
          {workspaces.flatMap(ws =>
            mountedIds.has(ws.id)
              ? (tabs[ws.id] ?? []).map(tab => (
                  <Terminal
                    key={tab.id}
                    sessionId={tab.id}
                    workspacePath={ws.path}
                    isActive={ws.id === activeId && tab.id === activeTabId[ws.id]}
                    fontFamily={settings.fontFamily}
                    fontSize={settings.fontSize}
                  />
                ))
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
    </div>
  );
}
