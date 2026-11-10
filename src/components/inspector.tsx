import { PreviewContext } from './module-mask';
import { useContext, useEffect, useState } from 'react';
import { CodeProperties } from './code-properties';
import { VisualProperties, ConnectionProperties } from './visual-properties';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Copy, Maximize2, Network, Plus, Scan, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Field, IconButton, SideSelect } from './editor-ui';
import { isInterface, type BlockData, type BlockNode, type Port, type FlowSettings } from '@/model';
import type { Edge } from '@xyflow/react';

export function Inspector({ node, edge, nodes, activePort, setActivePort, update, resize, updatePort, removePort, addPort, enter, duplicate, remove, updateEdge }: {
  updateEdge: (patch: FlowSettings) => void;
  node?: BlockNode; edge?: Edge; nodes: BlockNode[]; activePort: string | null;
  setActivePort: (id: string | null) => void;
  update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void;
  updatePort: (id: string, patch: Partial<Port>) => void; removePort: (id: string) => void;
  addPort: (type: Port['type']) => void; enter: (id: string) => void; duplicate: () => void; remove: () => void;
}) {
  const preview = useContext(PreviewContext).values;
  const [tab, setTab] = useState<'properties' | 'visuals' | 'code'>('properties');
  const codeBlock = node?.data.kind === 'javascript' || node?.data.kind === 'python';
  useEffect(() => { if (!codeBlock && tab === 'code') setTab('properties'); }, [codeBlock, tab]);
  const parent = node?.data.kind === 'subsystem'; const boundary = node && isInterface(node);
  return <Card className="floating-panel inspector-panel" aria-label="Inspector">
    <div className="panel-scroll">
      {node ? <>
        <div className="selection-heading"><span className="selection-icon">{parent ? <Network/> : boundary ? <ArrowUpRight/> : <Scan/>}</span><div><strong>{node.data.label || 'Untitled block'}</strong><span>{parent ? 'Nested canvas' : boundary ? 'Parent interface' : `${node.data.kind} block`}</span></div><Badge variant="outline">{parent ? 'Parent' : boundary ? 'Port' : 'Block'}</Badge></div>
        <div className="inspector-tabs" role="tablist" aria-label="Block properties">{(codeBlock ? ['properties', 'visuals', 'code'] as const : ['properties', 'visuals'] as const).map(t => <button key={t} role="tab" id={`tab-${t}`} aria-controls={`panel-${t}`} aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'properties' ? 'Properties' : t === 'code' ? 'Code' : 'Visuals'}</button>)}</div>
        <div role="tabpanel" id="panel-properties" aria-labelledby="tab-properties" hidden={tab !== 'properties'}>
        <section className="property-section">
          <Field label={boundary ? 'Port name' : 'Block name'}><Input aria-label={boundary ? 'Interface port name' : 'Block name'} value={node.data.label} onChange={e => update({ label: e.target.value })}/></Field>
          {!parent && !boundary && <Field label={node.data.kind === 'gain' ? 'Gain factor' : node.data.kind === 'constant' ? 'Constant value' : node.data.kind === 'javascript' ? 'Fallback value' : 'Parameter'}><Input aria-label="Display value" value={node.data.value} onChange={e => update({ value: e.target.value })}/></Field>}
          <Field label="Description"><Textarea aria-label="Block description" rows={2} value={node.data.description} onChange={e => update({ description: e.target.value })}/></Field>

          {node.data.kind === 'python' && <p className="field-help">Edit Python source in Code. Source is saved for your own runtime; Python does not execute here.</p>}
          {node.data.kind === 'javascript' && <Field label="Live inputs → outputs"><pre className="signal-preview">{JSON.stringify(preview[node.id] ?? {}, null, 2)}</pre><p className="field-help">Use these port IDs in your module. Edit its source in Code.</p></Field>}
        </section>
        {node.data.kind === 'renderer' && <section className="property-section"><h3>Value display</h3><Field label="Decimal precision"><Input aria-label="Renderer precision" type="number" min={0} max={12} value={node.data.renderer?.precision ?? 4} onChange={e => { const precision = Number(e.target.value); if (Number.isInteger(precision) && precision >= 0 && precision <= 12) update({ renderer: { slice: node.data.renderer?.slice ?? 0, precision } }); }}/></Field><Field label="Tensor slice (zero-based)"><Input aria-label="Tensor slice" type="number" min={0} max={10000} value={node.data.renderer?.slice ?? 0} onChange={e => { const slice = Number(e.target.value); if (Number.isInteger(slice) && slice >= 0 && slice <= 10000) update({ renderer: { precision: node.data.renderer?.precision ?? 4, slice } }); }}/></Field></section>}
        <Separator/>
        {boundary ? <section className="property-section"><h3>Parent interface</h3><p className="field-help">This block defines an {node.data.kind === 'inport' ? 'input' : 'output'} on the parent. Its name and side stay in sync.</p><Field label="Side on parent"><SideSelect label="Exposed port side" value={node.data.exposedSide ?? (node.data.kind === 'inport' ? 'left' : 'right')} onChange={exposedSide => update({ exposedSide })}/></Field><div className="interface-direction">{node.data.kind === 'inport' ? <ArrowDownLeft/> : <ArrowUpRight/>}<span>{node.data.kind === 'inport' ? 'Parent input → internal output' : 'Internal input → parent output'}</span></div></section> : <section className="property-section"><div className="section-heading"><h3>Inputs & outputs</h3><Badge variant="secondary">{node.data.ports.length}</Badge></div>{parent && <p className="field-help">Defined by Input and Output blocks in the internal canvas.</p>}
          <div className="ports-list">{node.data.ports.map(p => <Collapsible key={p.id} open={activePort === p.id} onOpenChange={open => setActivePort(open ? p.id : null)} className="port-item"><div className="port-item-heading"><CollapsibleTrigger asChild><Button variant="ghost" className="port-trigger"><span className={`port-indicator ${p.type}`}/><span>{p.name}</span><span className="port-side">{p.side}</span><ChevronDown className={activePort === p.id ? 'rotate-180' : ''}/></Button></CollapsibleTrigger><IconButton label={`Remove port ${p.name}`} size="icon-xs" onClick={() => removePort(p.id)}><X/></IconButton></div><CollapsibleContent><div className="port-properties"><Field label="Name"><Input aria-label="Port name" value={p.name} onChange={e => updatePort(p.id, { name: e.target.value })}/></Field><p className="field-help">ID: <code>{p.id}</code> · {p.type}</p><Field label="Side"><SideSelect value={p.side} onChange={side => updatePort(p.id, { side })}/></Field></div></CollapsibleContent></Collapsible>)}</div>
          <div className="add-ports"><Button variant="outline" size="sm" onClick={() => addPort('input')}><Plus/>Input</Button><Button variant="outline" size="sm" onClick={() => addPort('output')}><Plus/>Output</Button></div>
          {parent && <Button variant="secondary" className="enter-canvas-button" onClick={() => enter(node.id)}><Network/>Enter canvas<Maximize2/></Button>}
        </section>}
        </div><div role="tabpanel" id="panel-visuals" aria-labelledby="tab-visuals" hidden={tab !== 'visuals'}><VisualProperties node={node} update={update} resize={resize}/></div>
        {codeBlock && <div role="tabpanel" id="panel-code" aria-labelledby="tab-code" hidden={tab !== 'code'}><CodeProperties key={node.id} node={node} update={update}/></div>}
        <Separator/><div className="inspector-actions"><Button variant="outline" size="sm" onClick={duplicate}><Copy/>Duplicate</Button><IconButton label="Delete selected block" variant="outline" onClick={remove}><Trash2/></IconButton></div>
      </> : edge ? <div className="property-section"><h3>Connection</h3><p className="field-help">{nodes.find(n => n.id === edge.source)?.data.label} → {nodes.find(n => n.id === edge.target)?.data.label}</p><ConnectionProperties settings={{ route: edge.type === 'default' ? 'bezier' : 'smoothstep', ...edge.data } as FlowSettings} update={updateEdge}/><Button variant="outline" size="sm" onClick={remove}><Trash2/>Delete connection</Button></div> : <div className="inspector-empty"><Scan size={27} strokeWidth={1.3}/><h3>No selection</h3><p>Select a block or connection<br/>to edit its properties.</p><Badge variant="outline">Shift + click to select multiple</Badge></div>}
    </div>
  </Card>;
}
