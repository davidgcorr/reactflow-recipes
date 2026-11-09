import type { Edge, Node, Viewport } from '@xyflow/react';

export type Side = 'left' | 'right' | 'top' | 'bottom';
export type Port = { id: string; name: string; type: 'input' | 'output'; side: Side };
export type BlockData = { label: string; kind: string; description: string; color: string; value: string; ports: Port[] };
export type BlockNode = Node<BlockData, 'block'>;
export type Diagram = { version: 1; name: string; nodes: BlockNode[]; edges: Edge[]; viewport: Viewport };
export const colors = ['#7b69db', '#418fbe', '#35977c', '#ce9344', '#cc7487', '#6c788b'];
export const templates = [
  { kind: 'constant', label: 'Constant', description: 'A fixed signal value', symbol: '1', color: colors[0], value: '1', inputs: 0, outputs: 1 },
  { kind: 'gain', label: 'Gain', description: 'Scale an input signal', symbol: '×', color: colors[1], value: '2', inputs: 1, outputs: 1 },
  { kind: 'sum', label: 'Sum', description: 'Combine incoming signals', symbol: 'Σ', color: colors[2], value: '++', inputs: 2, outputs: 1 },
  { kind: 'integrator', label: 'Integrator', description: 'Integrate a signal over time', symbol: '∫', color: colors[3], value: '1/s', inputs: 1, outputs: 1 },
  { kind: 'scope', label: 'Scope', description: 'A signal output endpoint', symbol: '⌁', color: colors[4], value: '', inputs: 1, outputs: 0 },
  { kind: 'custom', label: 'Custom block', description: 'Make it your own', symbol: '□', color: colors[5], value: 'f(x)', inputs: 1, outputs: 1 },
];
export function makeNode(kind: string, position: { x: number; y: number }, id: string = crypto.randomUUID()): BlockNode {
  const t = templates.find(t => t.kind === kind) ?? templates[5];
  const ports: Port[] = [
    ...Array.from({ length: t.inputs }, (_, i): Port => ({ id: `in-${i}`, name: t.inputs > 1 ? `in ${i + 1}` : 'in', type: 'input', side: 'left' })),
    ...Array.from({ length: t.outputs }, (_, i): Port => ({ id: `out-${i}`, name: 'out', type: 'output', side: 'right' })),
  ];
  return { id, type: 'block', position, width: 164, height: 116, data: { label: t.label, kind: t.kind, description: t.description, color: t.color, value: t.value, ports } };
}
export function exampleDiagram(): Diagram {
  const nodes = [makeNode('constant', { x: 60, y: 180 }, 'source'), makeNode('gain', { x: 330, y: 180 }, 'gain'), makeNode('sum', { x: 600, y: 180 }, 'sum'), makeNode('scope', { x: 870, y: 180 }, 'scope'), makeNode('constant', { x: 330, y: 410 }, 'offset')];
  nodes[0].data.label = 'Input signal'; nodes[1].data.label = 'Amplifier'; nodes[2].data.label = 'Add offset'; nodes[3].data.label = 'Output'; nodes[4].data.label = 'Offset'; nodes[4].data.value = '0.5';
  const edge = (id: string, source: string, target: string, targetHandle = 'in-0'): Edge => ({ id, source, target, sourceHandle: 'out-0', targetHandle, type: 'smoothstep' });
  return { version: 1, name: 'Signal processing', nodes, edges: [edge('e1', 'source', 'gain'), edge('e2', 'gain', 'sum'), edge('e3', 'sum', 'scope'), edge('e4', 'offset', 'sum', 'in-1')], viewport: { x: 20, y: 80, zoom: 0.85 } };
}
export function serializeDiagram(diagram: Diagram): string {
  return JSON.stringify({ ...diagram, nodes: diagram.nodes.map(({ id, type, position, width, height, data }) => ({ id, type, position, width: width ?? 164, height: height ?? 116, data })), edges: diagram.edges.map(({ id, source, target, sourceHandle, targetHandle, type }) => ({ id, source, target, sourceHandle, targetHandle, type: type ?? 'smoothstep' })) }, null, 2);
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function parseDiagram(json: string): Diagram {
  const d: unknown = JSON.parse(json);
  if (!record(d) || d.version !== 1 || typeof d.name !== 'string' || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('Expected version 1, a name, nodes, and edges.');
  if (d.nodes.length > 2000 || d.edges.length > 10000) throw new Error('Diagram exceeds the 2,000 block / 10,000 connection limit.');
  const nodes: BlockNode[] = []; const ids = new Set<string>();
  for (const n of d.nodes) {
    if (!record(n) || typeof n.id !== 'string' || !n.id || ids.has(n.id) || n.type !== 'block' || !record(n.position) || !finite(n.position.x) || !finite(n.position.y) || !finite(n.width) || n.width < 120 || !finite(n.height) || n.height < 90 || !record(n.data)) throw new Error('Each block needs a unique ID, type "block", position, width ≥ 120, and height ≥ 90.');
    const b = n.data;
    if (['label', 'kind', 'description', 'color', 'value'].some(k => typeof b[k] !== 'string') || !/^#[0-9a-f]{6}$/i.test(String(b.color)) || !Array.isArray(b.ports)) throw new Error(`Invalid data for block ${n.id}.`);
    const ports = new Set<string>();
    for (const p of b.ports) {
      if (!record(p) || typeof p.id !== 'string' || !p.id || ports.has(p.id) || typeof p.name !== 'string' || !['input', 'output'].includes(String(p.type)) || !['left', 'right', 'top', 'bottom'].includes(String(p.side))) throw new Error(`Invalid or duplicate port in block ${n.id}.`);
      ports.add(p.id);
    }
    ids.add(n.id); nodes.push({ id: n.id, type: 'block', position: { x: n.position.x, y: n.position.y }, width: n.width, height: n.height, data: { label: b.label as string, kind: b.kind as string, description: b.description as string, color: b.color as string, value: b.value as string, ports: b.ports as Port[] } });
  }
  const edgeIds = new Set<string>(); const occupied = new Set<string>(); const edges: Edge[] = [];
  for (const e of d.edges) {
    if (!record(e) || typeof e.id !== 'string' || !e.id || edgeIds.has(e.id) || typeof e.source !== 'string' || typeof e.target !== 'string' || e.source === e.target) throw new Error('Connections need unique IDs and different source / target blocks.');
    const source = nodes.find(n => n.id === e.source); const target = nodes.find(n => n.id === e.target);
    if (!source?.data.ports.some(p => p.id === e.sourceHandle && p.type === 'output') || !target?.data.ports.some(p => p.id === e.targetHandle && p.type === 'input')) throw new Error(`Connection ${e.id} must link an existing output to an existing input.`);
    const key = JSON.stringify([e.target, e.targetHandle]); if (occupied.has(key)) throw new Error('Each input accepts only one connection.');
    edgeIds.add(e.id); occupied.add(key); edges.push({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle as string, targetHandle: e.targetHandle as string, type: 'smoothstep' });
  }
  if (!record(d.viewport) || !finite(d.viewport.x) || !finite(d.viewport.y) || !finite(d.viewport.zoom) || d.viewport.zoom < 0.15 || d.viewport.zoom > 2.5) throw new Error('Viewport needs x, y and zoom between 0.15 and 2.5.');
  return { version: 1, name: d.name, nodes, edges, viewport: { x: d.viewport.x, y: d.viewport.y, zoom: d.viewport.zoom } };
}
