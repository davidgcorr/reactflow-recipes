import { useEffect, useState, type ReactNode } from 'react';
export function ResizablePanel({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(() => { try { const n = Number(localStorage.getItem('milver.inspector.width')); return n >= 300 && n <= 900 ? n : 360; } catch { return 360; } });
  useEffect(() => { try { localStorage.setItem('milver.inspector.width', String(width)); } catch {} }, [width]);
  const clamp = (n: number) => Math.min(900, Math.max(300, Math.min(window.innerWidth - 48, n)));
  return <div className="right-panel-position resizable-inspector" style={{ width }}><div role="separator" tabIndex={0} aria-label="Resize inspector" aria-orientation="vertical" aria-valuemin={300} aria-valuemax={900} aria-valuenow={width} className="inspector-resize-handle" onDoubleClick={() => setWidth(360)} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setWidth(clamp(window.innerWidth - e.clientX - 16)); }} onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setWidth(w => clamp(w + (e.key === 'ArrowLeft' ? 24 : -24))); } }}>{/* Drag from the canvas-facing edge. */}</div>{children}</div>;
}
