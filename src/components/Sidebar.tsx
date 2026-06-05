import type { Workspace } from '../types';

interface SidebarProps {
  workspaces: Workspace[];
  activeId: string | null;
  connectedIds: Set<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSettings: () => void;
}

export function Sidebar({ workspaces, activeId, connectedIds, onSelect, onAdd, onRemove, onSettings }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Orbit</span>
        <button type="button" className="icon-btn" title="Settings" onClick={onSettings}>⚙</button>
      </div>
      <div className="section-label">PROJECTS</div>
      <div className="workspace-list">
        {workspaces.map(ws => (
          <div
            key={ws.id}
            role="button"
            tabIndex={0}
            className={`workspace-item ${ws.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(ws.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(ws.id); }}
          >
            <span className={`status-dot ${connectedIds.has(ws.id) ? 'connected' : 'idle'}`} />
            <span className="workspace-name">{ws.name}</span>
            <button
              type="button"
              className="remove-btn"
              onClick={e => { e.stopPropagation(); onRemove(ws.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <button type="button" className="add-btn" onClick={onAdd}>
          + New workspace
        </button>
      </div>
    </div>
  );
}
