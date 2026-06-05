import { useState, useRef } from 'react';
import type { Workspace } from '../types';

const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24'];

interface SidebarProps {
  workspaces: Workspace[];
  activeId: string | null;
  connectedIds: Set<string>;
  compact: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onSetColor: (id: string, color: string) => void;
  onSettings: () => void;
  onToggleCompact: () => void;
}

export function Sidebar({ workspaces, activeId, connectedIds, compact, onSelect, onAdd, onRemove, onReorder, onSetColor, onSettings, onToggleCompact }: SidebarProps) {
  const [filter, setFilter] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  const filtered = filter
    ? workspaces.filter(ws => ws.name.toLowerCase().includes(filter.toLowerCase()))
    : workspaces;

  const cycleColor = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!connectedIds.has(ws.id)) return;
    const idx = COLORS.indexOf(ws.color ?? '');
    onSetColor(ws.id, COLORS[(idx + 1) % COLORS.length]);
  };

  return (
    <div className={`sidebar${compact ? ' compact' : ''}`}>
      <div className="sidebar-header">
        {!compact && <span className="sidebar-title">Orbit</span>}
        <button
          type="button"
          className="sidebar-toggle-btn"
          title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCompact}
        >
          {compact ? '›' : '‹'}
        </button>
      </div>

      {!compact && workspaces.length > 3 && (
        <div className="sidebar-search-wrapper">
          <input
            type="text"
            className="sidebar-search"
            placeholder="Filter workspaces…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      )}

      {!compact && <div className="section-label">PROJECTS</div>}

      <div className="workspace-list">
        {filtered.map(ws => {
          const connected = connectedIds.has(ws.id);
          const dotColor = connected ? (ws.color ?? '#4ade80') : '#404040';
          return (
            <div
              key={ws.id}
              role="button"
              tabIndex={0}
              draggable={!compact}
              title={compact ? ws.name : undefined}
              className={`workspace-item ${ws.id === activeId ? 'active' : ''} ${dragOverId === ws.id ? 'drag-over' : ''}`}
              onClick={() => onSelect(ws.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(ws.id); }}
              onDragStart={() => { dragRef.current = ws.id; }}
              onDragOver={e => { e.preventDefault(); setDragOverId(ws.id); }}
              onDrop={() => {
                if (dragRef.current && dragRef.current !== ws.id) onReorder(dragRef.current, ws.id);
                setDragOverId(null);
              }}
              onDragEnd={() => { dragRef.current = null; setDragOverId(null); }}
            >
              <span
                className="status-dot"
                style={{ background: dotColor, boxShadow: connected ? `0 0 4px ${dotColor}66` : 'none', cursor: connected ? 'pointer' : 'default' }}
                title={connected && !compact ? 'Click to change color' : undefined}
                onClick={e => cycleColor(ws, e)}
              />
              {!compact && <span className="workspace-name">{ws.name}</span>}
              {!compact && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={e => { e.stopPropagation(); onRemove(ws.id); }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {!compact && filtered.length === 0 && filter && (
          <p className="sidebar-empty-filter">No match for "{filter}"</p>
        )}
      </div>

      <div className="sidebar-footer">
        {compact ? (
          <>
            <button type="button" className="icon-btn footer-settings-btn" title="Settings" onClick={onSettings}>⚙</button>
            <button type="button" className="add-btn add-btn-compact" title="Add workspace" onClick={onAdd}>+</button>
          </>
        ) : (
          <>
            <button type="button" className="add-btn" onClick={onAdd}>+ New workspace</button>
            <button type="button" className="icon-btn footer-settings-btn" title="Settings" onClick={onSettings}>⚙</button>
          </>
        )}
      </div>
    </div>
  );
}
