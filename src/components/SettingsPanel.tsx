import { useEffect, useRef } from 'react';
import type { Settings } from '../types';

const FONT_FAMILIES = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", "Menlo", "Monaco", monospace' },
  { label: 'Menlo',          value: '"Menlo", monospace' },
  { label: 'Monaco',         value: '"Monaco", monospace' },
  { label: 'SF Mono',        value: '"SF Mono", "Menlo", monospace' },
  { label: 'Fira Code',      value: '"Fira Code", "Menlo", monospace' },
  { label: 'Cascadia Code',  value: '"Cascadia Code", "Consolas", monospace' },
  { label: 'Courier New',    value: '"Courier New", monospace' },
];

const COMMAND_PRESETS = ['claude', 'codex', 'aider', 'zsh', 'bash'];

const SHORTCUTS = [
  { label: 'New tab',            keys: ['⌘', 'T'] },
  { label: 'Close tab',          keys: ['⌘', 'W'] },
  { label: 'Switch to tab 1–9',  keys: ['⌘', '1–9'] },
  { label: 'Session history',    keys: ['⌘', '⇧', 'H'] },
];

interface SettingsPanelProps {
  settings: Settings;
  onClose: () => void;
  onChange: (settings: Settings) => void;
}

export function SettingsPanel({ settings, onClose, onChange }: SettingsPanelProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const set = (updates: Partial<Settings>) => onChange({ ...settings, ...updates });

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* ── Terminal ── */}
        <div className="settings-section">
          <div className="settings-section-title">TERMINAL</div>

          <div className="settings-row">
            <span className="settings-label">Font family</span>
            <select
              className="settings-select"
              value={settings.fontFamily}
              onChange={e => set({ fontFamily: e.target.value })}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <span className="settings-label">Font size</span>
            <div className="settings-slider-row">
              <input
                type="range"
                className="settings-slider"
                min={10}
                max={20}
                value={settings.fontSize}
                onChange={e => set({ fontSize: Number(e.target.value) })}
              />
              <span className="settings-slider-value">{settings.fontSize}</span>
            </div>
          </div>
        </div>

        {/* ── Shell ── */}
        <div className="settings-section">
          <div className="settings-section-title">COMMAND</div>
          <div className="settings-row">
            <span className="settings-label">Command</span>
            <input
              type="text"
              className="settings-input"
              value={settings.shell}
              onChange={e => set({ shell: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div className="settings-presets">
            {COMMAND_PRESETS.map(s => (
              <button
                key={s}
                type="button"
                className={`settings-preset-btn ${settings.shell === s ? 'active' : ''}`}
                onClick={() => set({ shell: s })}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="settings-hint">Applied to new sessions — restart existing tabs to use the new command.</p>
        </div>

        {/* ── Startup ── */}
        <div className="settings-section">
          <div className="settings-section-title">STARTUP</div>
          <div className="settings-row">
            <span className="settings-label">Auto-start sessions</span>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={e => set({ autoStart: e.target.checked })}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
          <p className="settings-hint">Automatically spawn all sessions when Orbit launches.</p>
        </div>

        {/* ── Budget ── */}
        <div className="settings-section">
          <div className="settings-section-title">BUDGET ALERT</div>
          <div className="settings-row">
            <span className="settings-label">Alert threshold ($)</span>
            <input
              type="number"
              className="settings-input"
              min={0}
              step={1}
              placeholder="0 = off"
              value={settings.budgetAlert || ''}
              onChange={e => set({ budgetAlert: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <p className="settings-hint">Get notified when accumulated cost per workspace exceeds this amount. 0 = disabled.</p>
        </div>

        {/* ── Keyboard shortcuts ── */}
        <div className="settings-section">
          <div className="settings-section-title">KEYBOARD SHORTCUTS</div>
          <table className="shortcuts-table">
            <tbody>
              {SHORTCUTS.map(({ label, keys }) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>
                    {keys.map((k, i) => (
                      <span key={i}><span className="shortcut-key">{k}</span>{i < keys.length - 1 ? ' ' : ''}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
