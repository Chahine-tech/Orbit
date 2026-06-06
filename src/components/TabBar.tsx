import { useEffect, useRef } from 'react';
import type { Tab } from '../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  editingTabId: string | null;
  tabStatus: Record<string, 'running' | 'exited'>;
  compactedSessions: Set<string>;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onAddWorktree: () => void;
  onClose: (tabId: string) => void;
  onStartEdit: (tabId: string) => void;
  onRename: (tabId: string, label: string) => void;
}

export function TabBar({ tabs, activeTabId, editingTabId, tabStatus, compactedSessions, onSelect, onAdd, onAddWorktree, onClose, onStartEdit, onRename }: TabBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId) inputRef.current?.focus();
  }, [editingTabId]);

  return (
    <div className="tab-bar">
      {tabs.map(tab => {
        const exited = tabStatus[tab.id] === 'exited';
        const isWorktree = !!tab.worktreeBranch;
        const isCompacted = compactedSessions.has(tab.id);
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={tab.id === activeTabId}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${exited ? 'exited' : ''}`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => onStartEdit(tab.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(tab.id);
              if (e.key === 'F2') onStartEdit(tab.id);
            }}
          >
            <span className={`tab-icon ${exited ? 'tab-icon-exited' : isWorktree ? 'tab-icon-worktree' : ''}`}>
              {exited ? '⊘' : isWorktree ? '⎇' : '⌨'}
            </span>
            {editingTabId === tab.id ? (
              <input
                ref={inputRef}
                aria-label="Rename tab"
                className="tab-input"
                defaultValue={tab.label}
                onClick={e => e.stopPropagation()}
                onBlur={e => onRename(tab.id, e.target.value.trim() || tab.label)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') onRename(tab.id, tab.label);
                }}
              />
            ) : (
              <>
                <span className="tab-label">{tab.label}</span>
                {isCompacted && <span className="tab-compacted" title="Context was auto-compacted">⚡</span>}
              </>
            )}
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${tab.label}`}
              onClick={e => { e.stopPropagation(); onClose(tab.id); }}
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="tab-add" title="New session (⌘T)" onClick={onAdd}>+</button>
      <button type="button" className="tab-add tab-add-worktree" title="New worktree tab" onClick={onAddWorktree}>⎇</button>
    </div>
  );
}
