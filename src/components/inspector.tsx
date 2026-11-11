import { CodeEditor } from './code-editor';
import { isControlled } from '@/block-code';
import { RenderProperties } from './render-properties';
import { ProjectModuleProperties, OperationProperties } from './project-modules';
import { ProjectContext } from '@/project/context';
import { PreviewContext } from './module-mask';
import { useContext, useEffect, useRef, useState } from 'react';
import { CodeProperties } from './code-properties';
import { ConnectionProperties } from './visual-properties';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Copy, Maximize2, Network, Plus, Scan, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Field, IconButton, SideSelect } from './editor-ui';
import { makeNode, parseDiagram, isInterface, type BlockData, type BlockNode, type Port, type FlowSettings } from '@/model';
import type { Edge } from '@xyflow/react';

export function Inspector({ maskError, node, edge, nodes, activePort, setActivePort, update, resize, updatePort, removePort, addPort, enter, duplicate, remove, updateEdge }: {
  maskError?: string;
  updateEdge: (patch: FlowSettings) => void;
  node?: BlockNode; edge?: Edge; nodes: BlockNode[]; activePort: string | null;
  setActivePort: (id: string | null) => void;
  update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void;
  updatePort: (id: string, patch: Partial<Port>) => void; removePort: (id: string) => void;
  addPort: (type: Port['type']) => void; enter: (id: string) => void; duplicate: () => void; remove: () => void;
}) {
  const project = useContext(ProjectContext);
  const preview = useContext(PreviewContext).values;
  const [tab, setTab] = useState<'properties' | 'render' | 'code' | 'json'>('properties');
  const codeBlock = node?.data.kind === 'javascript' || node?.data.kind === 'python' || node?.data.operation?.type === 'code';
  useEffect(() => { if (!codeBlock && tab === 'code') setTab('properties'); }, [codeBlock, tab]);
  const parent = node?.data.kind === 'subsystem'; const boundary = node && isInterface(node);
  return <Card className="floating-panel inspector-panel" aria-label="Inspector">
    <div className="panel-scroll">
      {node ? <>
        <div className="selection-heading"><span className="selection-icon">{parent ? <Network/> : boundary ? <ArrowUpRight/> : <Scan/>}</span><div><strong>{node.data.label || 'Untitled block'}</strong><span>{parent ? 'Nested canvas' : boundary ? 'Parent interface' : `${node.data.kind} block`}</span></div><Badge variant="outline">{parent ? 'Parent' : boundary ? 'Port' : 'Block'}</Badge></div>
        <div className="inspector-tabs" role="tablist" aria-label="Block properties">{(codeBlock ? ['properties', 'render', 'code', 'json'] as const : ['properties', 'render', 'json'] as const).map(t => <Button variant="ghost" size="sm" key={t} role="tab" id={`tab-${t}`} aria-controls={`panel-${t}`} aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'properties' ? 'Properties' : t === 'code' ? 'Code' : t === 'json' ? 'JSON' : 'Render'}</Button>)}</div>
        <div role="tabpanel" id="panel-properties" aria-labelledby="tab-properties" hidden={tab !== 'properties'}>
        <section className="property-section">
          <Field label={boundary ? 'Port name' : 'Block name'}><Input disabled={isControlled(node.data, 'label')} aria-label={boundary ? 'Interface port name' : 'Block name'} value={node.data.label} onChange={e => update({ label: e.target.value })}/></Field>
          {!parent && !boundary && <Field label={node.data.kind === 'gain' ? 'Gain factor' : node.data.kind === 'constant' ? 'Constant value' : node.data.kind === 'javascript' ? 'Fallback value' : 'Parameter'}><Input disabled={isControlled(node.data, 'value')} aria-label="Display value" value={node.data.value} onChange={e => update({ value: e.target.value })}/></Field>}
          <Field label="Description"><Textarea disabled={isControlled(node.data, 'description')} aria-label="Block description" rows={2} value={node.data.description} onChange={e => update({ description: e.target.value })}/></Field>

          {node.data.kind === 'python' && <p className="field-help">Edit Python source in Code. Source is saved for your own runtime; Python does not execute here.</p>}

        </section>
        {node.data.kind === 'module' && <ProjectModuleProperties key={node.id} node={node} update={update}/>}
        {node.data.operation && <OperationProperties key={node.id} node={node} update={update}/>}

        {node.data.kind === 'renderer' && <section className="property-section"><h3>Math / value display</h3><Field label="Formula size (px)"><Input aria-label="Renderer font size" type="number" min={10} max={72} value={node.data.renderer?.fontSize ?? 24} onChange={e => { const fontSize = Number(e.target.value); if (fontSize >= 10 && fontSize <= 72) update({ renderer: { precision: node.data.renderer?.precision ?? 4, slice: node.data.renderer?.slice ?? 0, fontSize } }); }}/></Field><Field label="Decimal precision"><Input aria-label="Renderer precision" type="number" min={0} max={12} value={node.data.renderer?.precision ?? 4} onChange={e => { const precision = Number(e.target.value); if (Number.isInteger(precision) && precision >= 0 && precision <= 12) update({ renderer: { ...node.data.renderer, slice: node.data.renderer?.slice ?? 0, precision } }); }}/></Field><Field label="Tensor slice (zero-based)"><Input aria-label="Tensor slice" type="number" min={0} max={10000} value={node.data.renderer?.slice ?? 0} onChange={e => { const slice = Number(e.target.value); if (Number.isInteger(slice) && slice >= 0 && slice <= 10000) update({ renderer: { ...node.data.renderer, precision: node.data.renderer?.precision ?? 4, slice } }); }}/></Field></section>}
        <Separator/>
        {boundary ? <section className="property-section"><h3>Parent interface</h3><p className="field-help">This block defines an {node.data.kind === 'inport' ? 'input' : 'output'} on the parent. Its name and side stay in sync.</p><Field label="Side on parent"><SideSelect label="Exposed port side" value={node.data.exposedSide ?? (node.data.kind === 'inport' ? 'left' : 'right')} onChange={exposedSide => update({ exposedSide })}/></Field><div className="interface-direction">{node.data.kind === 'inport' ? <ArrowDownLeft/> : <ArrowUpRight/>}<span>{node.data.kind === 'inport' ? 'Parent input → internal output' : 'Internal input → parent output'}</span></div></section> : <section className="property-section"><div className="section-heading"><h3>Inputs & outputs</h3><Badge variant="secondary">{node.data.ports.length}</Badge></div>{parent && <p className="field-help">Defined by Input and Output blocks in the internal canvas.</p>}
          <div className="ports-list">{node.data.ports.map(p => <Collapsible key={p.id} open={activePort === p.id} onOpenChange={open => setActivePort(open ? p.id : null)} className="port-item"><div className="port-item-heading"><CollapsibleTrigger asChild><Button variant="ghost" className="port-trigger"><span className={`port-indicator ${p.type}`}/><span>{p.name}</span><span className="port-side">{p.side}</span><ChevronDown className={activePort === p.id ? 'rotate-180' : ''}/></Button></CollapsibleTrigger><IconButton label={`Remove port ${p.name}`} size="icon-xs" onClick={() => removePort(p.id)}><X/></IconButton></div><CollapsibleContent><div className="port-properties"><Field label="Name"><Input aria-label="Port name" value={p.name} onChange={e => updatePort(p.id, { name: e.target.value })}/></Field><p className="field-help">ID: <code>{p.id}</code> · {p.type}</p><Field label="Side"><SideSelect value={p.side} onChange={side => updatePort(p.id, { side })}/></Field></div></CollapsibleContent></Collapsible>)}</div>
          <div className="add-ports"><Button variant="outline" size="sm" onClick={() => addPort('input')}><Plus/>Input</Button><Button variant="outline" size="sm" onClick={() => addPort('output')}><Plus/>Output</Button></div>
          {parent && <Button variant="secondary" className="enter-canvas-button" onClick={() => enter(node.id)}><Network/>Enter canvas<Maximize2/></Button>}
        </section>}
        </div><div role="tabpanel" id="panel-render" aria-labelledby="tab-render" hidden={tab !== 'render'}><RenderProperties node={node} update={update} resize={resize}/></div>
        {codeBlock && <div role="tabpanel" id="panel-code" aria-labelledby="tab-code" hidden={tab !== 'code'}>
          <CodeProperties key={node.id} node={node} update={update}/>
          <section className="property-section"><h3>Runtime</h3>
            {(maskError || project.values[node.id]?.error) && <p role="alert" className="code-error">{maskError || project.values[node.id]?.error}</p>}
            <Field label="Inputs → outputs"><pre className="signal-preview">{JSON.stringify(preview[node.id] ?? {}, null, 2)}</pre></Field>
            {node.data.state && <Field label="Saved state"><pre className="signal-preview">{JSON.stringify(node.data.state, null, 2)}</pre></Field>}
            {project.values[node.id] && <p className="field-help">{project.values[node.id].status} · {project.values[node.id].ms.toFixed(2)} ms{project.values[node.id].cached ? ' · cached' : ''}</p>}
          </section>
        </div>}

        <div role="tabpanel" id="panel-json" aria-labelledby="tab-json" hidden={tab !== 'json'}><BlockJson key={node.id} node={node} update={update}/></div>
        {node.data.kind === 'javascript' && <div className="save-block-action"><Button variant="secondary" size="sm" onClick={() => project.saveBlock(node)}>Save to My Blocks</Button></div>}
        <Separator/><div className="inspector-actions"><Button variant="outline" size="sm" onClick={duplicate}><Copy/>Duplicate</Button><IconButton label="Delete selected block" variant="outline" onClick={remove}><Trash2/></IconButton></div>
      </> : edge ? <div className="property-section"><h3>Connection</h3><p className="field-help">{nodes.find(n => n.id === edge.source)?.data.label} → {nodes.find(n => n.id === edge.target)?.data.label}</p><ConnectionProperties settings={{ route: edge.type === 'default' ? 'bezier' : 'smoothstep', ...edge.data } as FlowSettings} update={updateEdge}/><Button variant="outline" size="sm" onClick={remove}><Trash2/>Delete connection</Button></div> : <div className="inspector-empty"><Scan size={27} strokeWidth={1.3}/><h3>No selection</h3><p>Select a block or connection<br/>to edit its properties.</p><Badge variant="outline">Shift + click to select multiple</Badge></div>}
    </div>
  </Card>;
}

function BlockJson({ node, update }: { node: BlockNode; update: (patch: Partial<BlockData>) => void }) {
  const source = JSON.stringify(node.data, null, 2);
  const [draft, setDraft] = useState(source), [error, setError] = useState('');
  const previousSource = useRef(source);
  useEffect(() => { const previous = previousSource.current; previousSource.current = source; setDraft(current => current === previous ? source : current); }, [source]);
  return <section className="property-section"><h3>Block JSON</h3><p className="field-help">The exact saved <code>nodes[].data</code>. Changes here update the inspector and canvas. Export project JSON for libraries, wiring and geometry.</p><CodeEditor label="Block JSON" language="json" value={draft} onChange={setDraft}/><Button size="sm" disabled={draft === source} onClick={() => { try { const data = JSON.parse(draft); const wrapper = makeNode('subsystem', { x: 0, y: 0 });
      wrapper.data.canvas = { nodes: [{ ...node, data }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
      const validated = parseDiagram(JSON.stringify({ version: 1, name: 'Block', nodes: [wrapper], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }));
      const next = validated.nodes[0].data.canvas!.nodes[0].data;
      update(Object.fromEntries([...new Set([...Object.keys(node.data), ...Object.keys(next)])].map(key => [key, next[key as keyof BlockData]])) as BlockData); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>Apply JSON</Button>{error && <p className="code-error" role="alert">{error}</p>}</section>;
}
