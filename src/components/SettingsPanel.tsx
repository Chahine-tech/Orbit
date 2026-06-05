import { useEffect } from 'react';
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

const SHELL_PRESETS = ['claude', 'zsh', 'bash', 'fish'];

const SHORTCUTS = [
  { label: 'New tab',            keys: ['⌘', 'T'] },
  { label: 'Close tab',          keys: ['⌘', 'W'] },
  { label: 'Switch to tab 1–9',  keys: ['⌘', '1–9'] },
];

interface SettingsPanelProps {
  settings: Settings;
  onClose: () => void;
  onChange: (settings: Settings) => void;
}

export function SettingsPanel({ settings, onClose, onChange }: SettingsPanelProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
          <div className="settings-section-title">SHELL</div>
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
            {SHELL_PRESETS.map(s => (
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
          <p className="settings-hint">Applied to new sessions — restart existing tabs to use the new shell.</p>
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
