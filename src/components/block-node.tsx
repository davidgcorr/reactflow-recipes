import { createContext, useContext, useEffect } from 'react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { ArrowDownLeft, ArrowUpRight, Box, ChevronRight, Network } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type BlockNode } from '@/model';
import { cn } from '@/lib/utils';

const positions = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
export const BlockContext = createContext({ snapshot: () => {}, enter: (_id: string) => {} });
export function Block({ id, data, selected }: NodeProps<BlockNode>) {
  const update = useUpdateNodeInternals();
  const { snapshot, enter } = useContext(BlockContext);
  useEffect(() => { update(id); }, [data.ports, id, update]);
  const parent = data.kind === 'subsystem';
  const boundary = data.kind === 'inport' || data.kind === 'outport';
  return <Card className={cn('diagram-block', selected && 'block-selected', parent && 'parent-block', boundary && 'interface-block')}>
    <NodeResizer isVisible={selected} minWidth={120} minHeight={90} color="var(--primary)" onResizeStart={snapshot}/>
    <div className="block-header"><span>{parent ? <Network/> : data.kind === 'inport' ? <ArrowDownLeft/> : data.kind === 'outport' ? <ArrowUpRight/> : <Box/>}{parent ? 'PARENT' : boundary ? `${data.kind === 'inport' ? 'INPUT' : 'OUTPUT'} PORT` : data.kind.toUpperCase()}</span>{parent && <Badge variant="secondary" className="block-count">{data.canvas?.nodes.length ?? 0}</Badge>}</div>
    <div className="block-body">{parent ? <div className="subsystem-symbol"><span/><i/><span/><i/><span/></div> : boundary ? <span className="interface-symbol">{data.kind === 'inport' ? '↳' : '↗'}</span> : data.kind === 'scope' ? <svg width="55" height="27" viewBox="0 0 55 27"><path d="M1 20h8L17 5l10 17 10-12 8 7h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> : <span className="block-value">{data.kind === 'gain' ? `× ${data.value}` : data.value || 'ƒ'}</span>}</div>
    <div className="block-footer"><span>{data.label}</span>{parent && <Button variant="ghost" size="icon-xs" className="nodrag nopan enter-block" onClick={() => enter(id)} aria-label={`Enter ${data.label}`} title="Enter parent canvas"><ChevronRight size={13}/></Button>}</div>
    {data.ports.map(p => {
      const group = data.ports.filter(other => other.side === p.side); const offset = `${(group.findIndex(other => other.id === p.id) + 1) / (group.length + 1) * 100}%`;
      return <Handle key={p.id} id={p.id} type={p.type === 'input' ? 'target' : 'source'} position={positions[p.side]} style={p.side === 'left' || p.side === 'right' ? { top: offset } : { left: offset }} className={`block-port port-${p.type}`} title={`${p.name} · ${p.type}`}><span className={`port-label port-label-${p.side}`}>{p.name}</span></Handle>;
    })}
  </Card>;
}
