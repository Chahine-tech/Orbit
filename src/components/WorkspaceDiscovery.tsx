import { useState, useEffect } from 'react';

interface Repo {
  name: string;
  path: string;
}

interface WorkspaceDiscoveryProps {
  folderPath: string;
  repos: Repo[];
  onAdd: (selected: Repo[]) => void;
  onAddParent: () => void;
  onCancel: () => void;
}

export function WorkspaceDiscovery({ folderPath, repos, onAdd, onAddParent, onCancel }: WorkspaceDiscoveryProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(repos.map(r => r.path)));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const toggle = (repoPath: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(repoPath)) next.delete(repoPath);
      else next.add(repoPath);
      return next;
    });
  };

  const folderName = folderPath.split('/').pop() ?? folderPath;
  const selectedRepos = repos.filter(r => selected.has(r.path));
  const count = selectedRepos.length;

  return (
    <div className="discovery-overlay" onClick={onCancel}>
      <div className="discovery-dialog" onClick={e => e.stopPropagation()}>
        <div className="discovery-header">
          <span className="discovery-title">
            Found {repos.length} git repo{repos.length !== 1 ? 's' : ''}
          </span>
          <span className="discovery-subtitle">in {folderName}/</span>
        </div>
        <div className="discovery-list">
          {repos.map(repo => (
            <label key={repo.path} className={`discovery-item ${selected.has(repo.path) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(repo.path)}
                onChange={() => toggle(repo.path)}
              />
              <span className="discovery-item-name">{repo.name}</span>
            </label>
          ))}
        </div>
        <div className="discovery-actions">
          <button type="button" className="discovery-parent-btn" onClick={onAddParent}>
            Add {folderName} as one workspace
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="discovery-cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="discovery-add-btn"
            disabled={count === 0}
            onClick={() => onAdd(selectedRepos)}
          >
            {count === 0 ? 'Add workspaces' : `Add ${count} workspace${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
