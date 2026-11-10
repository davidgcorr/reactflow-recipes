import { describe, expect, it } from 'vitest';
import { portAtBorder, portOffset } from './ports';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram, updateCanvas } from './model';
import { handlePoint } from './export/scene';

describe('movable block ports', () => {
  it('keeps automatic spacing for older diagrams and uses explicit offsets in exports', () => {
    const node = makeNode('sum', { x: 40, y: 70 }, 'sum');
    expect(portOffset(node.data.ports, node.data.ports[0])).toBeCloseTo(1 / 3);
    node.data.ports[0].offset = 0.8;
    expect(handlePoint(node, node.data.ports[0])).toMatchObject({ x: 40, y: 70 + 116 * 0.8 });
  });
  it('projects a dragged port to all four borders and keeps it away from corners', () => {
    expect(portAtBorder(2, 80, 200, 100)).toEqual({ side: 'left', offset: 0.8 });
    expect(portAtBorder(198, 30, 200, 100)).toEqual({ side: 'right', offset: 0.3 });
    expect(portAtBorder(60, -5, 200, 100)).toEqual({ side: 'top', offset: 0.3 });
    expect(portAtBorder(160, 103, 200, 100)).toEqual({ side: 'bottom', offset: 0.8 });
    expect(portAtBorder(-50, -30, 200, 100).offset).toBeGreaterThan(0);
  });
  it('magnetizes the center and evenly spaced slots according to the destination border', () => {
    const node = makeNode('sum', { x: 0, y: 0 }, 'sum');
    const ports = node.data.ports;
    // Two inputs on the left produce thirds, while the center remains available.
    expect(portAtBorder(0, 35, 200, 100, ports, 'in-0').offset).toBeCloseTo(1 / 3);
    expect(portAtBorder(0, 66, 200, 100, ports, 'in-0').offset).toBeCloseTo(2 / 3);
    expect(portAtBorder(0, 52, 200, 100, ports, 'in-0').offset).toBe(0.5);
    // Crossing onto the right border counts the existing output and incoming input.
    expect(portAtBorder(200, 35, 200, 100, ports, 'in-0').offset).toBeCloseTo(1 / 3);
    ports.push({ id: 'in-2', name: 'third', side: 'left', type: 'input' });
    expect(portAtBorder(0, 26, 200, 100, ports, 'in-0').offset).toBe(0.25);
    expect(portAtBorder(0, 74, 200, 100, ports, 'in-0').offset).toBe(0.75);
    expect(portAtBorder(0, 41, 200, 100, ports, 'in-0').offset).toBe(0.41);
    expect(portAtBorder(104, 0, 200, 100, ports, 'in-0').offset).toBe(0.5);
  });
  it('round trips port locations and nested interfaces and preserves them after child edits', () => {
    const diagram = exampleDiagram();
    const parent = makeNode('subsystem', { x: 0, y: 0 }, 'parent');
    parent.data.canvas!.nodes[0].data.exposedSide = 'bottom';
    parent.data.canvas!.nodes[0].data.exposedOffset = 0.72;
    diagram.nodes.push(parent);
    const updated = updateCanvas(diagram, ['parent'], c => ({ ...c, nodes: c.nodes.map(n => ({ ...n, position: { x: n.position.x + 5, y: n.position.y } })) }));
    updated.nodes[0].data.ports[0].offset = 0.25;
    const parsed = parseDiagram(serializeDiagram(updated));
    expect(parsed.nodes[0].data.ports[0].offset).toBe(0.25);
    expect(parsed.nodes.at(-1)!.data.ports[0]).toMatchObject({ side: 'bottom', offset: 0.72 });
    expect(parsed.nodes.at(-1)!.data.canvas!.nodes[0].data.exposedOffset).toBe(0.72);
  });
  it('rejects invalid persisted port positions', () => {
    for (const offset of [-0.1, 1.1, '0.4', null]) {
      const data = JSON.parse(serializeDiagram(exampleDiagram()));
      data.nodes[0].data.ports[0].offset = offset;
      expect(() => parseDiagram(JSON.stringify(data))).toThrow('port offset');
    }
  });
  it('preserves Python code as source without evaluating it', () => {
    const diagram = exampleDiagram();
    const python = makeNode('python', { x: 0, y: 0 }, 'python');
    python.data.module = 'def process(inputs, value):\n    return 42';
    diagram.nodes.push(python);
    expect(parseDiagram(serializeDiagram(diagram)).nodes.at(-1)!.data.module).toBe(python.data.module);
  });
});
