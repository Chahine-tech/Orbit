import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
interface TerminalProps {
  sessionId: string;
  workspacePath: string;
  isActive: boolean;
  fontFamily: string;
  fontSize: number;
}

export function Terminal({ sessionId, workspacePath, isActive, fontFamily, fontSize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

    xterm.onData(data => window.api.ptyWrite(sessionId, data));
    xterm.onResize(({ cols, rows }) => window.api.ptyResize(sessionId, cols, rows));

    const cleanupData = window.api.onPtyData((id, data) => {
      if (id === sessionId) xterm.write(data);
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      xtermRef.current = null;
      cleanupData();
      observer.disconnect();
      window.api.ptyKill(sessionId);
      xterm.dispose();
    };
  }, [sessionId, workspacePath]);

  // Apply font changes live to existing terminal instances
  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.fontFamily = fontFamily;
    xtermRef.current.options.fontSize = fontSize;
    fitAddonRef.current?.fit();
  }, [fontFamily, fontSize]);

  useEffect(() => {
    if (!isActive) return;
    const id = setTimeout(() => fitAddonRef.current?.fit(), 50);
    return () => clearTimeout(id);
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{ display: isActive ? 'flex' : 'none', height: '100%', width: '100%' }}
    />
  );
}

