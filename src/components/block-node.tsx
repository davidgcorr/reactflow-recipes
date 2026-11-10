import { ModuleMask } from './module-mask';
import { createContext, useContext, useEffect, useRef } from 'react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { blockTypePath, type BlockNode, type Port } from '@/model';
import { portAtBorder, portOffset } from '@/ports';
import { cn } from '@/lib/utils';

const positions = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
export const BlockContext = createContext({ snapshot: () => {}, enter: (_id: string) => {}, movePort: (_nodeId: string, _portId: string, _patch: Partial<Port>) => {}, setHeader: (_id: string, _show: boolean) => {} });
export function Block({ id, data, selected }: NodeProps<BlockNode>) {
  const update = useUpdateNodeInternals();
  const block = useRef<HTMLDivElement>(null);
  const drag = useRef<DOMRect | null>(null);
  const { snapshot, enter, movePort, setHeader } = useContext(BlockContext);
  useEffect(() => { update(id); }, [data.ports, id, update]);
  const visuals = data.visuals ?? {};
  const ink = visuals.foreground ?? 'var(--primary)';
  const fill = visuals.background ?? 'var(--card)';
  const parent = data.kind === 'subsystem';
  const typePath = blockTypePath(data.kind);
  const boundary = data.kind === 'inport' || data.kind === 'outport';
  return <Card ref={block} className={cn('diagram-block', selected && 'block-selected', parent && 'parent-block', boundary && 'interface-block')} style={{ background: fill, color: ink, borderRadius: visuals.radius, '--block-ink': ink, ...(visuals.foreground ? { '--primary': visuals.foreground, '--muted-foreground': visuals.foreground } : {}) } as React.CSSProperties}>
    <NodeResizer isVisible={selected} minWidth={120} minHeight={90} color="var(--primary)" onResizeStart={snapshot}/>
    {visuals.showHeader !== false ? <button type="button" className="block-type-trail nodrag nopan" aria-label="Collapse block type" aria-expanded="true" onClick={event => { event.stopPropagation(); setHeader(id, false); }} onDoubleClick={event => event.stopPropagation()}><span>{typePath[0]}</span><ChevronRight/><span>{typePath[1]}</span><ChevronDown className="type-collapse"/></button> : <button type="button" className="block-type-expand nodrag nopan" aria-label="Show block type" aria-expanded="false" onClick={event => { event.stopPropagation(); setHeader(id, true); }} onDoubleClick={event => event.stopPropagation()}><ChevronDown/></button>}

    <div className="block-body" style={{ color: ink, visibility: visuals.showValue === false ? 'hidden' : undefined }}>{data.kind === 'javascript' ? <ModuleMask id={id} source={data.module} value={data.value} color={ink} background={visuals.background ?? 'transparent'}/> : data.kind === 'python' ? <span className="block-value">Py</span> : parent ? <div className="subsystem-symbol"><span/><i/><span/><i/><span/></div> : boundary ? <span className="interface-symbol">{data.kind === 'inport' ? '↳' : '↗'}</span> : data.kind === 'scope' ? <svg width="55" height="27" viewBox="0 0 55 27"><path d="M1 20h8L17 5l10 17 10-12 8 7h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> : <span className="block-value">{data.kind === 'gain' ? `× ${data.value}` : data.value || 'ƒ'}</span>}</div>
    {visuals.showLabel !== false && <div className="block-footer"><span>{data.label}</span>{parent && <Button variant="ghost" size="icon-xs" className="nodrag nopan enter-block" onClick={() => enter(id)} aria-label={`Enter ${data.label}`} title="Enter parent canvas"><ChevronRight size={13}/></Button>}</div>}
    {data.ports.map(p => {
      const offset = `${portOffset(data.ports, p) * 100}%`;
      const vertical = p.side === 'left' || p.side === 'right';
      return <div key={p.id} className={`port-anchor port-anchor-${p.side}`} tabIndex={0} aria-label={`${p.name} ${p.type} port`} style={vertical ? { top: offset } : { left: offset }}><Handle id={p.id} type={p.type === 'input' ? 'target' : 'source'} position={positions[p.side]} style={{ left: p.side === 'right' ? 24 : 12, top: p.side === 'bottom' ? 24 : 12, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }} className={`block-port port-${p.type}`} title={`${p.name} · ${p.type}`}>{visuals.showPortLabels !== false && <span className={`port-label port-label-${p.side}`}>{p.name}</span>}</Handle><button type="button" className={`port-move port-move-${p.side} nodrag nopan`} aria-label={`Move port ${p.name}`} title={`Drag to move ${p.name} along the block border`}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); drag.current = block.current!.getBoundingClientRect(); snapshot(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return; event.stopPropagation(); const rect = drag.current; movePort(id, p.id, portAtBorder(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, data.ports, p.id)); }}
        onPointerUp={event => { event.stopPropagation(); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
        onKeyDown={event => { const delta = { ArrowUp: -0.02, ArrowLeft: -0.02, ArrowDown: 0.02, ArrowRight: 0.02 }[event.key]; if (delta === undefined) return; event.preventDefault(); event.stopPropagation(); snapshot(); movePort(id, p.id, { offset: Math.max(0.05, Math.min(0.95, portOffset(data.ports, p) + delta)) }); }}><GripVertical/></button></div>;
    })}
  </Card>;
}
