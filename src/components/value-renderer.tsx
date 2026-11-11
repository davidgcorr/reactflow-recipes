import katex from 'katex';
import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PreviewContext } from './module-mask';
import { describeValue, formatValue } from '@/value-renderer';
import type { RendererConfig } from '@/code-config';

function FitMatrix({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, width: 0, height: 0 });
  useLayoutEffect(() => {
    const fit = () => {
      if (!viewport.current || !content.current) return;
      const width = content.current.scrollWidth, height = content.current.scrollHeight;
      const scale = Math.min(1, (viewport.current.clientWidth - 12) / Math.max(1, width), (viewport.current.clientHeight - 8) / Math.max(1, height));
      setSize({ scale: Math.max(0.01, scale), width, height });
    };
    fit();
    const observer = new ResizeObserver(fit); observer.observe(viewport.current!); observer.observe(content.current!);
    return () => observer.disconnect();
  }, [children]);
  return <div ref={viewport} className="matrix-viewport"><div className="matrix-fit" style={{ width: size.width * size.scale, height: size.height * size.scale }}><div ref={content} className="matrix-content" style={{ transform: `scale(${size.scale})` }}>{children}</div></div></div>;
}
export function ValueRenderer({ id, settings = { precision: 4, slice: 0 } }: { id: string; settings?: RendererConfig }) {
  const { values } = useContext(PreviewContext);
  const value = Object.values(values[id]?.inputs ?? {})[0] ?? null;
  const view = describeValue(value, settings.slice);
  const numeric = view.shape.length > 0 || view.kind === 'Number';
  const format = (x: unknown) => typeof x === 'number' ? Number(x.toFixed(settings.precision)).toString() : String(x ?? '');
  const tex = view.shape.length ? String.raw`\begin{bmatrix}${view.rows.map(row => row.map(format).join(' & ')).join(String.raw` \\ `)}\end{bmatrix}` : format(view.rows[0]?.[0]);
  const formula = numeric ? katex.renderToString(tex, { output: 'mathml', throwOnError: false, trust: false, displayMode: true }) : '';
  return <div className="value-renderer"><div className="value-renderer-meta">{view.kind}{view.shape.length > 0 && <span>{view.shape.join(' × ')}</span>}{view.slices > 1 && <span>slice {view.slice + 1}/{view.slices}</span>}</div>{view.error ? <p role="status">{view.error}</p> : numeric ? <><FitMatrix><div className="value-formula" style={{ fontSize: settings.fontSize ?? 24 }} role="img" aria-label={`${view.kind} values`} dangerouslySetInnerHTML={{ __html: formula }}/></FitMatrix>{view.shape.some(d => d > 32) && <small>Preview: first 32 rows × 32 columns · resize block for more space</small>}</> : <output>{formatValue(view.rows[0]?.[0] ?? null, settings.precision)}</output>}</div>;
}
