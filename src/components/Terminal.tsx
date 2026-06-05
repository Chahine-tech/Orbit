import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  workspacePath: string;
  hidden: boolean;
  fontFamily: string;
  fontSize: number;
  restartCount: number;
  exited: boolean;
  onRestart: () => void;
  onInput: (data: string) => void;
}

export function Terminal({ sessionId, workspacePath, hidden, fontFamily, fontSize, restartCount, exited, onRestart, onInput }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Ref so onInput changes (e.g. broadcast toggle) don't recreate the PTY
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#404040',
      },
      fontFamily,
      fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    xtermRef.current = xterm;

    const { cols, rows } = xterm;
    window.api.ptyCreate(sessionId, workspacePath, cols, rows);

    xterm.onData((data: string) => onInputRef.current(data));
    xterm.onResize(({ cols, rows }: { cols: number; rows: number }) => window.api.ptyResize(sessionId, cols, rows));

    const cleanupData = window.api.onPtyData((id, data) => {
      if (id === sessionId) xterm.write(data);
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      xtermRef.current = null;
      fitAddonRef.current = null;
      cleanupData();
      observer.disconnect();
      window.api.ptyKill(sessionId);
      xterm.dispose();
    };
  }, [sessionId, workspacePath, restartCount]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.fontFamily = fontFamily;
    xtermRef.current.options.fontSize = fontSize;
    fitAddonRef.current?.fit();
  }, [fontFamily, fontSize]);

  useEffect(() => {
    if (hidden) return;
    const id = setTimeout(() => fitAddonRef.current?.fit(), 50);
    return () => clearTimeout(id);
  }, [hidden]);

  return (
    <div style={{ display: hidden ? 'none' : 'flex', height: '100%', width: '100%', flexDirection: 'column', position: 'relative' }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      {exited && (
        <div className="session-ended-banner">
          <span className="session-ended-label">⊘ Session ended</span>
          <button type="button" className="session-restart-btn" onClick={onRestart}>
            ↺ Restart
          </button>
        </div>
      )}
    </div>
  );
}
