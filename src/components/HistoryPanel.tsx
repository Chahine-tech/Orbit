import { useEffect, useRef, useState } from 'react';
import type { LogEntry, LogSearchResult } from '../types';

interface HistoryPanelProps {
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return 'yesterday';
  return d.toLocaleDateString();
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<LogSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.logsList().then(setEntries);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults(null); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await window.api.logsSearch(query.trim());
      setResults(r);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const displayEntries = results !== null
    ? results.map(r => ({ ...r, size: 0 }))
    : entries;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="history-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Session History</span>
          <button type="button" className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="history-search-row">
          <input
            className="history-search"
            placeholder="Search logs…"
            value={query}
            autoFocus
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="history-list">
          {loading && <div className="history-empty">Searching…</div>}
          {!loading && displayEntries.length === 0 && (
            <div className="history-empty">
              {results !== null ? 'No matches found.' : 'No sessions logged yet.'}
            </div>
          )}
          {!loading && displayEntries.map(entry => {
            const searchEntry = results?.find(r => r.sessionId === entry.sessionId);
            return (
              <div key={entry.sessionId} className="history-entry">
                <div className="history-entry-header">
                  <span className="history-workspace">{entry.workspaceName}</span>
                  <span className="history-meta">
                    {formatDate(entry.createdAt)}
                    {'size' in entry && entry.size > 0 ? ` · ${formatSize(entry.size)}` : ''}
                  </span>
                  <button
                    type="button"
                    className="history-open-btn"
                    title="Open log file in editor"
                    onClick={() => window.api.logsOpen(entry.logPath)}
                  >
                    ↗
                  </button>
                </div>
                {searchEntry && searchEntry.matches.map((m, i) => (
                  <div key={i} className="history-match">
                    <span className="history-match-line">{m.lineNumber}</span>
                    <span className="history-match-text">{m.line}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
