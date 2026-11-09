import { describe, expect, it } from 'vitest';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';

describe('diagram JSON contract', () => {
  it('round trips all editable properties and viewport', () => {
    const diagram = exampleDiagram();
    diagram.nodes[1].width = 278; diagram.nodes[1].height = 193;
    diagram.nodes[1].position = { x: -450, y: 1234 };
    diagram.nodes[1].data.ports[0].side = 'bottom';
    diagram.nodes[1].data.ports[1].side = 'top';
    diagram.viewport = { x: -1000, y: 2000, zoom: 0.45 };
    expect(parseDiagram(serializeDiagram(diagram))).toEqual(diagram);
  });
  it('excludes transient selection and measured dimensions', () => {
    const diagram = exampleDiagram(); diagram.nodes[0].selected = true;
    diagram.nodes[0].measured = { width: 200, height: 100 };
    const parsed = parseDiagram(serializeDiagram(diagram));
    expect(parsed.nodes[0].selected).toBeUndefined();
    expect(parsed.nodes[0].measured).toBeUndefined();
  });
  it('rejects duplicate block IDs', () => {
    const d = exampleDiagram(); d.nodes[1].id = d.nodes[0].id;
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('unique ID');
  });
  it('rejects dangling connections and input-to-input connections', () => {
    const d = exampleDiagram(); d.edges[0].sourceHandle = 'nonexistent';
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('existing output');
    d.edges[0].source = 'gain'; d.edges[0].sourceHandle = 'in-0'; d.edges[0].target = 'sum';
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('existing output');
  });
  it('rejects multiple connections to one input but allows output fan-out', () => {
    const d = exampleDiagram(); d.edges.push({ ...d.edges[0], id: 'duplicate' });
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('only one');
    d.edges.pop(); d.edges[2].source = 'source';
    expect(parseDiagram(JSON.stringify(d)).edges).toHaveLength(4);
  });
  it('rejects invalid port sides, duplicate ports and invalid dimensions', () => {
    const d = exampleDiagram(); const original = d.nodes[0].data.ports[0];
    d.nodes[0].data.ports.push({ ...original });
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('duplicate port');
    d.nodes[0].data.ports.pop();
    expect(() => parseDiagram(JSON.stringify(d).replace('"right"', '"diagonal"'))).toThrow('Invalid');
    d.nodes[0].width = -1;
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('width');
  });
  it('rejects unsupported versions, malformed JSON and invalid viewport', () => {
    expect(() => parseDiagram('{')).toThrow();
    expect(() => parseDiagram('{"version":2}')).toThrow('version 1');
    const d = exampleDiagram(); d.viewport.zoom = 0;
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('Viewport');
  });
  it('creates independent blocks and supports every template', () => {
    const a = makeNode('sum', { x: 0, y: 0 }); const b = makeNode('sum', { x: 0, y: 0 });
    expect(a.id).not.toBe(b.id); a.data.ports[0].side = 'top';
    expect(b.data.ports[0].side).toBe('left');
    expect(a.data.ports.filter(p => p.type === 'input')).toHaveLength(2);
    expect(makeNode('custom', { x: 0, y: 0 }).data.kind).toBe('custom');
  });
});

describe('nested parent canvases', () => {
  it('round trips nested canvases, interface ports, and the theme', async () => {
    const { defaultTheme } = await import('./model');
    const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { x: 0, y: 600 }, 'parent'));
    d.theme = { ...defaultTheme, mode: 'dark', hue: 255, chroma: 0.12, radius: 6 };
    expect(parseDiagram(serializeDiagram(d))).toEqual(d);
  });
  it('propagates interface names and sides to the parent and preserves external connections', async () => {
    const { updateCanvas } = await import('./model');
    const parent = makeNode('subsystem', { x: 300, y: 0 }, 'parent');
    const d = exampleDiagram(); d.nodes.push(parent);
    d.edges.push({ id: 'parent-wire', source: 'source', sourceHandle: 'out-0', target: 'parent', targetHandle: 'parent-input', type: 'smoothstep' });
    const updated = updateCanvas(d, ['parent'], c => ({ ...c, nodes: c.nodes.map(n => n.id === 'parent-input' ? { ...n, data: { ...n.data, label: 'Reference', exposedSide: 'top' } } : n) }));
    expect(updated.nodes.at(-1)!.data.ports[0]).toEqual({ id: 'parent-input', name: 'Reference', type: 'input', side: 'top' });
    expect(updated.edges.at(-1)!.id).toBe('parent-wire');
    expect(parseDiagram(serializeDiagram(updated))).toEqual(updated);
  });
  it('removes internal and external wires when an interface is deleted', async () => {
    const { updateCanvas } = await import('./model');
    const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { x: 0, y: 0 }, 'parent'));
    d.edges.push({ id: 'external', source: 'source', sourceHandle: 'out-0', target: 'parent', targetHandle: 'parent-input' });
    const updated = updateCanvas(d, ['parent'], c => ({ ...c, nodes: c.nodes.filter(n => n.id !== 'parent-input') }));
    const parent = updated.nodes.at(-1)!;
    expect(parent.data.ports).toHaveLength(1);
    expect(parent.data.canvas!.edges).toHaveLength(1);
    expect(updated.edges).not.toContainEqual(expect.objectContaining({ id: 'external' }));
    expect(() => parseDiagram(serializeDiagram(updated))).not.toThrow();
  });
  it('isolates nested changes and propagates deeply nested interface edits', async () => {
    const { updateCanvas, canvasAt } = await import('./model');
    const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { x: 0, y: 0 }, 'outer'));
    const nested = updateCanvas(d, ['outer'], c => ({ ...c, nodes: [...c.nodes, makeNode('subsystem', { x: 0, y: 500 }, 'inner')] }));
    const updated = updateCanvas(nested, ['outer', 'inner'], c => ({ ...c, nodes: c.nodes.map(n => n.id === 'inner-output' ? { ...n, data: { ...n.data, label: 'Result', exposedSide: 'bottom' } } : n) }));
    expect(canvasAt(updated, ['outer']).nodes.find(n => n.id === 'inner')!.data.ports[1].name).toBe('Result');
    expect(canvasAt(updated, ['outer', 'inner']).nodes.find(n => n.id === 'inner-output')!.data.exposedSide).toBe('bottom');
    expect(updated.nodes[0]).toEqual(d.nodes[0]);
    expect(parseDiagram(serializeDiagram(updated))).toEqual(updated);
  });
  it('preserves independent viewport positions at each level', async () => {
    const { updateCanvas, canvasAt } = await import('./model');
    const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { x: 0, y: 0 }, 'parent'));
    const updated = updateCanvas(d, ['parent'], c => ({ ...c, viewport: { x: -1000, y: 500, zoom: 0.55 } }));
    expect(updated.viewport).toEqual(d.viewport);
    expect(canvasAt(updated, ['parent']).viewport).toEqual({ x: -1000, y: 500, zoom: 0.55 });
  });
  it('rejects mismatched parent interfaces, orphan boundary blocks and malformed nested data', () => {
    const d = exampleDiagram(); const parent = makeNode('subsystem', { x: 0, y: 0 }, 'parent'); d.nodes.push(parent);
    parent.data.ports[0].name = 'mismatch';
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('must match');
    d.nodes.pop(); d.nodes.push(makeNode('inport', { x: 0, y: 0 }));
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('inside a parent');
    d.nodes.pop(); d.nodes.push(makeNode('subsystem', { x: 0, y: 0 }, 'parent'));
    d.nodes.at(-1)!.data.canvas!.edges[0].targetHandle = 'missing';
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('existing output');
  });
  it('strips transient selection at every nesting level', () => {
    const d = exampleDiagram(); const parent = makeNode('subsystem', { x: 0, y: 0 }, 'parent'); d.nodes.push(parent);
    parent.data.canvas!.nodes[0].selected = true; parent.data.canvas!.nodes[0].measured = { width: 164, height: 116 };
    const parsed = parseDiagram(serializeDiagram(d));
    expect(parsed.nodes.at(-1)!.data.canvas!.nodes[0].selected).toBeUndefined();
    expect(parsed.nodes.at(-1)!.data.canvas!.nodes[0].measured).toBeUndefined();
  });
  it('rejects invalid theme settings', async () => {
    const { defaultTheme } = await import('./model');
    const d = exampleDiagram(); d.theme = { ...defaultTheme, chroma: 2 };
    expect(() => parseDiagram(JSON.stringify(d))).toThrow('Invalid theme');
  });
});
