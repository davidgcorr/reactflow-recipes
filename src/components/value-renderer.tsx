import { useContext } from 'react';
import { PreviewContext } from './module-mask';
import { describeValue, formatValue } from '@/value-renderer';
import type { RendererConfig } from '@/code-config';
export function ValueRenderer({ id, settings = { precision: 4, slice: 0 } }: { id: string; settings?: RendererConfig }) {
  const { values } = useContext(PreviewContext);
  const value = Object.values(values[id]?.inputs ?? {})[0] ?? null;
  const view = describeValue(value, settings.slice);
  return <div className="value-renderer nowheel"><div className="value-renderer-meta">{view.kind}{view.shape.length > 0 && <span>{view.shape.join(' × ')}</span>}{view.slices > 1 && <span>slice {view.slice + 1}/{view.slices}</span>}</div>{view.error ? <p role="status">{view.error}</p> : view.shape.length ? <div className="value-table-scroll nodrag nopan"><table aria-label={`${view.kind} values`}><tbody>{view.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{formatValue(cell, settings.precision)}</td>)}</tr>)}</tbody></table>{view.shape.some(d => d > 32) && <small>Showing up to 32 rows × 32 columns</small>}</div> : <output>{formatValue(view.rows[0]?.[0] ?? null, settings.precision)}</output>}</div>;
}
