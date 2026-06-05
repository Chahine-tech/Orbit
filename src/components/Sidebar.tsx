import { useState, useRef } from 'react';
import type { Workspace } from '../types';

const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24'];

interface SidebarProps {
  workspaces: Workspace[];
  activeId: string | null;
  connectedIds: Set<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onSetColor: (id: string, color: string) => void;
  onSettings: () => void;
}

export function Sidebar({ workspaces, activeId, connectedIds, onSelect, onAdd, onRemove, onReorder, onSetColor, onSettings }: SidebarProps) {
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
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Orbit</span>
        <button type="button" className="icon-btn" title="Settings" onClick={onSettings}>⚙</button>
      </div>

      {workspaces.length > 3 && (
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

      <div className="section-label">PROJECTS</div>
      <div className="workspace-list">
        {filtered.map(ws => {
          const connected = connectedIds.has(ws.id);
          const dotColor = connected ? (ws.color ?? '#4ade80') : '#404040';
          return (
            <div
              key={ws.id}
              role="button"
              tabIndex={0}
              draggable
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
                title={connected ? 'Click to change color' : undefined}
                onClick={e => cycleColor(ws, e)}
              />
              <span className="workspace-name">{ws.name}</span>
              <button
                type="button"
                className="remove-btn"
                onClick={e => { e.stopPropagation(); onRemove(ws.id); }}
              >
                ×
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && filter && (
          <p className="sidebar-empty-filter">No match for "{filter}"</p>
        )}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="add-btn" onClick={onAdd}>
          + New workspace
        </button>
      </div>
    </div>
  );
}
