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
