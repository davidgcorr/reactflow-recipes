import { RenderBoundary } from './render-boundary';
import { RoughBlockOutline } from './rough-shapes';
import { isControlled } from '@/block-code';
import { ProjectContext } from '@/project/context';
import { ValueRenderer } from './value-renderer';
import { ModuleMask } from './module-mask';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { blockTypePath, type BlockNode, type Port } from '@/model';
import { portAtBorder, portOffset } from '@/ports';
import { cn } from '@/lib/utils';

const positions = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
export const BlockContext = createContext({ snapshot: () => {}, enter: (_id: string) => {}, movePort: (_nodeId: string, _portId: string, _patch: Partial<Port>) => {}, setHeader: (_id: string, _show: boolean) => {} });
export function Block(props: NodeProps<BlockNode>) {
  return <RenderBoundary resetKey={JSON.stringify([props.id, props.data.module, props.data.render, props.data.value])}><BlockContent {...props}/></RenderBoundary>;
}
function BlockContent({ id, data, selected, width = 164, height = 116 }: NodeProps<BlockNode>) {
  const project = useContext(ProjectContext);
  const runtime = project.values[id];
  const [snapGuide, setSnapGuide] = useState<{ side: Port['side']; offset: number } | null>(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { if (!selected) setInteractive(false); }, [selected]);
  const update = useUpdateNodeInternals();
  const block = useRef<HTMLDivElement>(null);
  const drag = useRef<DOMRect | null>(null);
  useEffect(() => {
    if (!interactive) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !block.current?.contains(event.target)) setInteractive(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setInteractive(false); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); };
  }, [interactive]);
  const { snapshot, enter, movePort, setHeader } = useContext(BlockContext);
  useEffect(() => { update(id); }, [data.ports, id, update]);
  const visuals = data.visuals ?? {};
  const ink = visuals.foreground ?? 'var(--primary)';
  const fill = visuals.background ?? 'var(--card)';
  const parent = data.kind === 'subsystem';
  const typePath = blockTypePath(data.kind);
  const boundary = data.kind === 'inport' || data.kind === 'outport';
  if (boundary) return <div ref={block} tabIndex={0} className={cn('interface-port-node', selected && 'is-selected')} style={{ color: ink, background: fill }} aria-label={`${data.label} · parent ${data.kind === 'inport' ? 'input' : 'output'}`}>
    <span className="interface-port-symbol">{data.kind === 'inport' ? '→' : '←'}</span><RoughBlockOutline id={id} width={28} height={28} circle/>
    <span className="interface-port-name">{data.label}</span>
    {data.ports.map(p => <Handle key={p.id} id={p.id} type={p.type === 'input' ? 'target' : 'source'} position={positions[p.side]} className={`compact-port-handle port-${p.type}`} title={`${p.name} · ${p.type}`}/>)}
  </div>;
  return <Card ref={block} tabIndex={0} onDoubleClick={event => { if (['javascript', 'renderer'].includes(data.kind)) { event.stopPropagation(); setInteractive(true); } }} onKeyDown={event => { if (['javascript', 'renderer'].includes(data.kind) && event.key === 'Enter' && event.target === event.currentTarget) setInteractive(true); }} className={cn('diagram-block', selected && 'block-selected', interactive && 'block-editing', parent && 'parent-block', boundary && 'interface-block', runtime?.status === 'error' && 'runtime-block-error')} style={{ background: fill, color: ink, borderRadius: visuals.radius, '--block-ink': ink, ...(visuals.foreground ? { '--primary': visuals.foreground, '--muted-foreground': visuals.foreground } : {}) } as React.CSSProperties}>
    <RoughBlockOutline id={id} width={width} height={height}/>
    <NodeResizer isVisible={selected && !isControlled(data, 'width') && !isControlled(data, 'height')} minWidth={120} minHeight={90} color="var(--primary)" onResizeStart={snapshot}/>
    {visuals.showHeader !== false ? <div className="block-type-trail"><span>{typePath[0]}</span><ChevronRight/><span>{data.recipe?.toLowerCase() ?? data.operation?.type ?? typePath[1]}</span><button type="button" className="type-collapse nodrag nopan" disabled={isControlled(data, 'visuals.showHeader')} aria-label="Collapse block type" aria-expanded="true" onClick={event => { event.stopPropagation(); setHeader(id, false); }} onDoubleClick={event => event.stopPropagation()}><ChevronDown/></button></div> : <button type="button" className="block-type-expand nodrag nopan" disabled={isControlled(data, 'visuals.showHeader')} aria-label="Show block type" aria-expanded="false" onClick={event => { event.stopPropagation(); setHeader(id, true); }} onDoubleClick={event => event.stopPropagation()}><ChevronDown/></button>}
    {snapGuide && <div aria-hidden="true" className={`port-snap-guide ${snapGuide.side === 'left' || snapGuide.side === 'right' ? 'horizontal' : 'vertical'}`} style={snapGuide.side === 'left' || snapGuide.side === 'right' ? { top: `${snapGuide.offset * 100}%` } : { left: `${snapGuide.offset * 100}%` }}/>}

    <div className={cn("block-body", interactive && "nodrag nopan")} style={{ color: ink, visibility: visuals.showValue === false ? 'hidden' : undefined }}>{data.kind === 'javascript' ? <ModuleMask id={id} ports={data.ports} dependencies={data.dependencies} wasm={data.wasm} interactive={interactive} source={data.module} render={data.render} state={data.state} value={data.value} color={ink} background={visuals.background ?? 'transparent'}/> : data.kind === 'module' ? <span className="shared-block-symbol">{project.modules.find(m => m.id === data.projectModuleId)?.alias ?? 'Module missing'}</span> : data.operation ? <div className="shared-block-preview"><span>{data.operation.type === 'construct' ? `new ${data.operation.exportName}` : data.operation.member ?? data.operation.exportName ?? 'run()'}</span><small>{runtime?.error ?? runtime?.status ?? 'Waiting for runtime'}</small></div> : data.kind === 'renderer' ? <ValueRenderer id={id} interactive={interactive} data={data} settings={data.renderer} color={ink} background={visuals.background ?? 'transparent'}/> : data.kind === 'python' ? <span className="block-value">Py</span> : parent ? <div className="subsystem-symbol"><span/><i/><span/><i/><span/></div> : boundary ? <span className="interface-symbol">{data.kind === 'inport' ? '↳' : '↗'}</span> : data.kind === 'scope' ? <svg width="55" height="27" viewBox="0 0 55 27"><path d="M1 20h8L17 5l10 17 10-12 8 7h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> : <span className="block-value">{data.kind === 'gain' ? `× ${data.value}` : data.value || 'ƒ'}</span>}</div>
    {visuals.showLabel !== false && <div className="block-footer"><span>{data.label}</span>{parent && <Button variant="ghost" size="icon-xs" className="nodrag nopan enter-block" onClick={() => enter(id)} aria-label={`Enter ${data.label}`} title="Enter parent canvas"><ChevronRight size={13}/></Button>}</div>}
    {data.ports.map(p => {
      const offset = `${portOffset(data.ports, p) * 100}%`;
      const vertical = p.side === 'left' || p.side === 'right';
      return <div key={p.id} className={`port-anchor port-anchor-${p.side}`} tabIndex={0} aria-label={`${p.name} ${p.type} port`} style={vertical ? { top: offset } : { left: offset }}><Handle id={p.id} type={p.type === 'input' ? 'target' : 'source'} position={positions[p.side]} style={{ left: p.side === 'right' ? 24 : 12, top: p.side === 'bottom' ? 24 : 12, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }} className={`block-port port-${p.type}`} title={`${p.name} · ${p.type}`}>{visuals.showPortLabels !== false && <span className={`port-label port-label-${p.side}`}>{p.name}</span>}</Handle><button type="button" className={`port-move port-move-${p.side} nodrag nopan`} aria-label={`Move port ${p.name}`} title={`Drag to move ${p.name} along the block border`}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); drag.current = block.current!.getBoundingClientRect(); snapshot(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return; event.stopPropagation(); const rect = drag.current; const { snapped, side, offset } = portAtBorder(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, data.ports, p.id); setSnapGuide(snapped ? { side, offset: offset! } : null); movePort(id, p.id, { side, offset }); }}
        onPointerUp={event => { event.stopPropagation(); drag.current = null; setSnapGuide(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { drag.current = null; setSnapGuide(null); }} onLostPointerCapture={() => { drag.current = null; setSnapGuide(null); }}
        onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
        onKeyDown={event => { const delta = { ArrowUp: -0.02, ArrowLeft: -0.02, ArrowDown: 0.02, ArrowRight: 0.02 }[event.key]; if (delta === undefined) return; event.preventDefault(); event.stopPropagation(); snapshot(); movePort(id, p.id, { offset: Math.max(0.05, Math.min(0.95, portOffset(data.ports, p) + delta)) }); }}><GripVertical/></button></div>;
    })}
  </Card>;
}
