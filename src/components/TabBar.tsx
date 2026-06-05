import { useEffect, useRef } from 'react';
import type { Tab } from '../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  editingTabId: string | null;
  tabStatus: Record<string, 'running' | 'exited'>;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onClose: (tabId: string) => void;
  onStartEdit: (tabId: string) => void;
  onRename: (tabId: string, label: string) => void;
}

export function TabBar({ tabs, activeTabId, editingTabId, tabStatus, onSelect, onAdd, onClose, onStartEdit, onRename }: TabBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId) inputRef.current?.focus();
  }, [editingTabId]);

  return (
    <div className="tab-bar">
      {tabs.map(tab => {
        const exited = tabStatus[tab.id] === 'exited';
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
            <span className={`tab-icon ${exited ? 'tab-icon-exited' : ''}`}>
              {exited ? '⊘' : '⌨'}
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
              <span className="tab-label">{tab.label}</span>
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
      <button type="button" className="tab-add" onClick={onAdd} title="New session">
        +
      </button>
    </div>
  );
}
