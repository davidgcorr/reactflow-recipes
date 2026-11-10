import type { Edge, Node, Viewport } from '@xyflow/react';

export type Side = 'left' | 'right' | 'top' | 'bottom';
export type Port = { id: string; name: string; type: 'input' | 'output'; side: Side; offset?: number };
export type ThemeSettings = { mode: 'light' | 'dark'; hue: number; chroma: number; radius: number };
export type BlockVisuals = { background?: string; foreground?: string; showHeader?: boolean; showLabel?: boolean; showValue?: boolean; showPortLabels?: boolean; radius?: number };
export type FlowSettings = { route?: 'smoothstep' | 'bezier'; points?: { x: number; y: number }[]; animation?: 'none' | 'dash' | 'pulse'; speed?: number; reverse?: boolean; color?: string; width?: number };
export type Canvas = { nodes: BlockNode[]; edges: Edge[]; viewport: Viewport };
export type BlockData = {
  label: string; kind: string; description: string; color: string; value: string; ports: Port[];
  visuals?: BlockVisuals;
  module?: string;
  canvas?: Canvas;
  exposedSide?: Side;
  exposedOffset?: number;
};
export type BlockNode = Node<BlockData, 'block'>;
export type Diagram = Canvas & { version: 1; name: string; theme?: ThemeSettings };
export const defaultTheme: ThemeSettings = { mode: 'light', hue: 0, chroma: 0, radius: 10 };
export const defaultViewport: Viewport = { x: 80, y: 160, zoom: 1 };
export const colors = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4'];
export const templates = [
  { kind: 'constant', label: 'Constant', description: 'A fixed signal value', symbol: '1', value: '1', inputs: 0, outputs: 1 },
  { kind: 'gain', label: 'Gain', description: 'Scale an input signal', symbol: '×', value: '2', inputs: 1, outputs: 1 },
  { kind: 'sum', label: 'Sum', description: 'Combine incoming signals', symbol: 'Σ', value: '++', inputs: 2, outputs: 1 },
  { kind: 'integrator', label: 'Integrator', description: 'Integrate over time', symbol: '∫', value: '1/s', inputs: 1, outputs: 1 },
  { kind: 'scope', label: 'Scope', description: 'A signal output endpoint', symbol: '⌁', value: '', inputs: 1, outputs: 0 },
  { kind: 'custom', label: 'Custom block', description: 'Define your own block', symbol: 'ƒ', value: 'f(x)', inputs: 1, outputs: 1 },
  { kind: 'javascript', label: 'JS module', description: 'A programmable, input-driven mask', symbol: 'JS', value: '1', inputs: 1, outputs: 1 },
  { kind: 'python', label: 'Python code', description: 'Editable Python source for your own runtime', symbol: 'Py', value: '', inputs: 1, outputs: 1 },
  { kind: 'subsystem', label: 'Parent block', description: 'A canvas inside a block', symbol: '⊞', value: '', inputs: 1, outputs: 1 },
  { kind: 'inport', label: 'Input', description: 'Expose an input on the parent', symbol: '→', value: '', inputs: 0, outputs: 1 },
  { kind: 'outport', label: 'Output', description: 'Expose an output on the parent', symbol: '→', value: '', inputs: 1, outputs: 0 },
];
export function blockTypePath(kind: string): [string, string] {
  const category = kind === 'javascript' || kind === 'python' ? 'code' : kind === 'subsystem' ? 'canvas' : kind === 'inport' || kind === 'outport' ? 'ports' : 'gens';
  const label = kind === 'subsystem' ? 'parent' : kind === 'inport' ? 'input' : kind === 'outport' ? 'output' : kind;
  return [category, label];
}
export const defaultModule = `export default function mount({ element, inputs, value, emit }) {
  const signal = inputs['in-0'] ?? Number(value);
  element.textContent = 'JS · ' + signal;
  element.style.font = '24px system-ui';
  emit(signal);
}`;
export const isInterface = (node: BlockNode) => node.data.kind === 'inport' || node.data.kind === 'outport';
export function interfacePorts(canvas: Canvas): Port[] {
  return canvas.nodes.filter(isInterface).map(n => ({ id: n.id, name: n.data.label, type: n.data.kind === 'inport' ? 'input' : 'output', side: n.data.exposedSide ?? (n.data.kind === 'inport' ? 'left' : 'right'), ...(n.data.exposedOffset !== undefined ? { offset: n.data.exposedOffset } : {}) }));
}
export function makeNode(kind: string, position: { x: number; y: number }, id: string = crypto.randomUUID()): BlockNode {
  const t = templates.find(t => t.kind === kind) ?? templates[5];
  const ports: Port[] = [
    ...Array.from({ length: t.inputs }, (_, i): Port => ({ id: `in-${i}`, name: t.inputs > 1 ? `in ${i + 1}` : 'in', type: 'input', side: 'left' })),
    ...Array.from({ length: t.outputs }, (_, i): Port => ({ id: `out-${i}`, name: 'out', type: 'output', side: 'right' })),
  ];
  const node: BlockNode = { id, type: 'block', position, width: kind === 'subsystem' ? 200 : 164, height: kind === 'subsystem' ? 140 : 116, data: { label: t.label, kind: t.kind, description: t.description, color: '#171717', value: t.value, ports } };
  if (kind === 'javascript') { node.width = 240; node.height = 190; node.data.module = defaultModule; }
  if (kind === 'python') { node.width = 240; node.height = 190; node.data.module = `def process(inputs, value):
    return inputs.get('in-0', value)
`; }
  if (kind === 'inport' || kind === 'outport') node.data.exposedSide = kind === 'inport' ? 'left' : 'right';
  if (kind === 'subsystem') {
    const input = makeNode('inport', { x: 0, y: 100 }, `${id}-input`);
    const gain = makeNode('gain', { x: 280, y: 100 }, `${id}-gain`);
    const output = makeNode('outport', { x: 560, y: 100 }, `${id}-output`);
    node.data.canvas = { nodes: [input, gain, output], edges: [
      { id: `${id}-e1`, source: input.id, sourceHandle: 'out-0', target: gain.id, targetHandle: 'in-0', type: 'smoothstep' },
      { id: `${id}-e2`, source: gain.id, sourceHandle: 'out-0', target: output.id, targetHandle: 'in-0', type: 'smoothstep' },
    ], viewport: { x: 100, y: 180, zoom: 1 } };
    node.data.ports = interfacePorts(node.data.canvas);
  }
  return node;
}
export function exampleDiagram(): Diagram {
  const nodes = [makeNode('constant', { x: 60, y: 180 }, 'source'), makeNode('gain', { x: 330, y: 180 }, 'gain'), makeNode('sum', { x: 600, y: 180 }, 'sum'), makeNode('scope', { x: 870, y: 180 }, 'scope'), makeNode('constant', { x: 330, y: 410 }, 'offset')];
  nodes[0].data.label = 'Input signal'; nodes[1].data.label = 'Amplifier'; nodes[2].data.label = 'Add offset'; nodes[3].data.label = 'Output'; nodes[4].data.label = 'Offset'; nodes[4].data.value = '0.5';
  const edge = (id: string, source: string, target: string, targetHandle = 'in-0'): Edge => ({ id, source, target, sourceHandle: 'out-0', targetHandle, type: 'smoothstep' });
  return { version: 1, name: 'Signal processing', nodes, edges: [edge('e1', 'source', 'gain'), edge('e2', 'gain', 'sum'), edge('e3', 'sum', 'scope'), edge('e4', 'offset', 'sum', 'in-1')], viewport: { x: 20, y: 80, zoom: 0.85 } };
}
// Remove dangling wires whenever an interface or block is removed.
export function cleanEdges(canvas: Canvas): Canvas {
  return { ...canvas, edges: canvas.edges.filter(e => e.source !== e.target && canvas.nodes.find(n => n.id === e.source)?.data.ports.some(p => p.id === e.sourceHandle && p.type === 'output') && canvas.nodes.find(n => n.id === e.target)?.data.ports.some(p => p.id === e.targetHandle && p.type === 'input')) };
}
export function canvasAt(root: Canvas, path: string[]): Canvas {
  let canvas = root;
  for (const id of path) {
    const child = canvas.nodes.find(n => n.id === id)?.data.canvas;
    if (!child) throw new Error('This nested canvas no longer exists.');
    canvas = child;
  }
  return canvas;
}
export function updateCanvas<T extends Canvas>(root: T, path: string[], transform: (canvas: Canvas) => Canvas): T {
  if (path.length === 0) return { ...root, ...cleanEdges(transform(root)) };
  const [id, ...rest] = path;
  const nodes = root.nodes.map(n => {
    if (n.id !== id || !n.data.canvas) return n;
    const child = updateCanvas(n.data.canvas, rest, transform);
    return { ...n, data: { ...n.data, canvas: child, ports: interfacePorts(child) } };
  });
  return { ...root, ...cleanEdges({ ...root, nodes }) };
}
function serializeCanvas(canvas: Canvas): Canvas {
  return { viewport: canvas.viewport, nodes: canvas.nodes.map(({ id, type, position, width, height, data }) => ({ id, type, position, width: width ?? 164, height: height ?? 116, data: { ...data, ...(data.canvas ? { canvas: serializeCanvas(data.canvas) } : {}) } })), edges: canvas.edges.map(({ id, source, target, sourceHandle, targetHandle, type, data }) => ({ id, source, target, sourceHandle, targetHandle, type: type ?? 'smoothstep', ...(data ? { data } : {}) })) };
}
export function serializeDiagram(diagram: Diagram): string { return JSON.stringify({ version: 1, name: diagram.name, ...(diagram.theme ? { theme: diagram.theme } : {}), ...serializeCanvas(diagram) }, null, 2); }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSide = (v: unknown): v is Side => ['left', 'right', 'top', 'bottom'].includes(String(v));
export function parseDiagram(json: string): Diagram {
  const d: unknown = JSON.parse(json);
  if (!record(d) || d.version !== 1 || typeof d.name !== 'string' || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('Expected version 1, a name, nodes, and edges.');
  let totalNodes = 0; let totalEdges = 0;
  function parseCanvas(value: unknown, depth: number): Canvas {
    if (depth > 16) throw new Error('Nested canvases can be at most 16 levels deep.');
    if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error('Each canvas needs nodes and edges.');
    totalNodes += value.nodes.length; totalEdges += value.edges.length;
    if (totalNodes > 2000 || totalEdges > 10000) throw new Error('Diagram exceeds the 2,000 block / 10,000 connection limit.');
    const nodes: BlockNode[] = []; const ids = new Set<string>();
    for (const n of value.nodes) {
      if (!record(n) || typeof n.id !== 'string' || !n.id || ids.has(n.id) || n.type !== 'block' || !record(n.position) || !finite(n.position.x) || !finite(n.position.y) || !finite(n.width) || n.width < 120 || !finite(n.height) || n.height < 90 || !record(n.data)) throw new Error('Each block needs a unique ID, type "block", position, width ≥ 120, and height ≥ 90.');
      const b = n.data;
      if (['label', 'kind', 'description', 'color', 'value'].some(k => typeof b[k] !== 'string') || !/^#[0-9a-f]{6}$/i.test(String(b.color)) || !Array.isArray(b.ports)) throw new Error(`Invalid data for block ${n.id}.`);
      const portIds = new Set<string>(); const ports: Port[] = [];
      for (const p of b.ports) {
        if (!record(p) || typeof p.id !== 'string' || !p.id || portIds.has(p.id) || typeof p.name !== 'string' || !['input', 'output'].includes(String(p.type)) || !isSide(p.side)) throw new Error(`Invalid or duplicate port in block ${n.id}.`);
        if (p.offset !== undefined && (!finite(p.offset) || p.offset < 0 || p.offset > 1)) throw new Error('Invalid port offset.');
        portIds.add(p.id); ports.push({ id: p.id, name: p.name, type: p.type as Port['type'], side: p.side, ...(p.offset !== undefined ? { offset: p.offset } : {}) });
      }
      const data: BlockData = { label: b.label as string, kind: b.kind as string, description: b.description as string, color: b.color as string, value: b.value as string, ports };
      if (b.module !== undefined) { if (typeof b.module !== 'string' || b.module.length > 100000) throw new Error('Invalid code module.'); data.module = b.module; }
      if (b.visuals !== undefined) {
        if (!record(b.visuals)) throw new Error('Invalid block visuals.');
        const v = b.visuals;
        for (const key of ['background', 'foreground']) if (v[key] !== undefined && (typeof v[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(v[key]))) throw new Error('Invalid visual color.');
        for (const key of ['showHeader', 'showLabel', 'showValue', 'showPortLabels']) if (v[key] !== undefined && typeof v[key] !== 'boolean') throw new Error('Invalid visual visibility.');
        if (v.radius !== undefined && (!finite(v.radius) || v.radius < 0 || v.radius > 60)) throw new Error('Invalid block radius.');
        data.visuals = Object.fromEntries(['background', 'foreground', 'showHeader', 'showLabel', 'showValue', 'showPortLabels', 'radius'].filter(k => v[k] !== undefined).map(k => [k, v[k]]));
      }
      if (b.exposedOffset !== undefined) { if (!finite(b.exposedOffset) || b.exposedOffset < 0 || b.exposedOffset > 1) throw new Error('Invalid exposed port offset.'); data.exposedOffset = b.exposedOffset; }
      if (b.exposedSide !== undefined) { if (!isSide(b.exposedSide)) throw new Error('Invalid exposed port side.'); data.exposedSide = b.exposedSide; }
      if ((b.kind === 'inport' || b.kind === 'outport') && depth === 0) throw new Error('Input and Output interface blocks belong inside a parent block.');
      if (b.kind === 'inport' || b.kind === 'outport') {
        const expected = b.kind === 'inport' ? 'output' : 'input';
        if (ports.length !== 1 || ports[0].type !== expected) throw new Error(`Interface block ${n.id} needs exactly one internal ${expected} port.`);
      }
      if (b.kind === 'subsystem') {
        if (!b.canvas) throw new Error(`Parent block ${n.id} needs an internal canvas.`);
        data.canvas = parseCanvas(b.canvas, depth + 1);
        const defined = interfacePorts(data.canvas);
        if (defined.length !== ports.length || defined.some(p => !ports.some(q => q.id === p.id && q.name === p.name && q.side === p.side && q.type === p.type && q.offset === p.offset))) throw new Error(`Parent block ${n.id} ports must match its internal Input and Output blocks.`);
      } else if (b.canvas !== undefined) throw new Error('Only parent blocks can contain a canvas.');
      ids.add(n.id); nodes.push({ id: n.id, type: 'block', position: { x: n.position.x, y: n.position.y }, width: n.width, height: n.height, data });
    }
    const edgeIds = new Set<string>(); const occupied = new Set<string>(); const edges: Edge[] = [];
    for (const e of value.edges) {
      if (!record(e) || typeof e.id !== 'string' || !e.id || edgeIds.has(e.id) || typeof e.source !== 'string' || typeof e.target !== 'string' || e.source === e.target) throw new Error('Connections need unique IDs and different source / target blocks.');
      const source = nodes.find(n => n.id === e.source); const target = nodes.find(n => n.id === e.target);
      if (!source?.data.ports.some(p => p.id === e.sourceHandle && p.type === 'output') || !target?.data.ports.some(p => p.id === e.targetHandle && p.type === 'input')) throw new Error(`Connection ${e.id} must link an existing output to an existing input.`);
      const key = JSON.stringify([e.target, e.targetHandle]); if (occupied.has(key)) throw new Error('Each input accepts only one connection.');
      edgeIds.add(e.id); occupied.add(key); edges.push({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle as string, targetHandle: e.targetHandle as string, type: e.type === 'default' ? 'default' : 'smoothstep', ...(e.data !== undefined ? { data: parseFlowSettings(e.data) } : {}) });
    }
    if (!record(value.viewport) || !finite(value.viewport.x) || !finite(value.viewport.y) || !finite(value.viewport.zoom) || value.viewport.zoom < 0.15 || value.viewport.zoom > 2.5) throw new Error('Viewport needs x, y and zoom between 0.15 and 2.5.');
    return { nodes, edges, viewport: { x: value.viewport.x, y: value.viewport.y, zoom: value.viewport.zoom } };
  }
  let theme: ThemeSettings | undefined;
  if (d.theme !== undefined) {
    const t = d.theme;
    if (!record(t) || (t.mode !== 'light' && t.mode !== 'dark') || !finite(t.hue) || t.hue < 0 || t.hue > 360 || !finite(t.chroma) || t.chroma < 0 || t.chroma > 0.22 || !finite(t.radius) || t.radius < 0 || t.radius > 20) throw new Error('Invalid theme: expected mode, hue 0–360, chroma 0–0.22, radius 0–20.');
    theme = { mode: t.mode, hue: t.hue, chroma: t.chroma, radius: t.radius };
  }
  return { version: 1, name: d.name, ...(theme ? { theme } : {}), ...parseCanvas(d, 0) };
}

export function parseFlowSettings(value: unknown): FlowSettings {
  if (!record(value)) throw new Error('Invalid connection settings.');
  const { route, points, animation, speed, reverse, color, width } = value;
  if (route !== undefined && route !== 'smoothstep' && route !== 'bezier' || animation !== undefined && !['none', 'dash', 'pulse'].includes(String(animation)) || speed !== undefined && (!finite(speed) || speed < 0.1 || speed > 20) || width !== undefined && (!finite(width) || width < 1 || width > 8) || reverse !== undefined && typeof reverse !== 'boolean' || color !== undefined && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('Invalid connection settings.');
  if (points !== undefined && (!Array.isArray(points) || points.length > 100 || points.some(p => !record(p) || !finite(p.x) || !finite(p.y)))) throw new Error('Invalid connection waypoints.');
  return Object.fromEntries(Object.entries({ route, points, animation, speed, reverse, color, width }).filter(([, v]) => v !== undefined)) as FlowSettings;
}
