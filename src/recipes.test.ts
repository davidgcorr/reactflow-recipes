import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { connectionPath } from './connections';
import { defaultModule, exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';
import { previewSignals } from './runtime';
import { buildScene, collectPages, defaultExportOptions } from './export/scene';

describe('reusable block recipes', () => {
  it('round trips module source, appearance and connection controls through JSON', () => {
    const d = exampleDiagram();
    const module = makeNode('javascript', { x: 100, y: 500 }, 'js');
    module.data.visuals = { background: '#fedcba', foreground: '#123456', showHeader: false, showValue: true, showLabel: false, showPortLabels: false, radius: 24 };
    d.nodes.push(module);
    d.edges[0].data = { route: 'bezier', points: [{ x: 200, y: 50 }], animation: 'pulse', speed: 3.5, reverse: true, color: '#ff0000', width: 3 };
    const parsed = parseDiagram(serializeDiagram(d));
    expect(parsed).toEqual(d);
    expect(parsed.nodes.at(-1)?.data.module).toBe(defaultModule);
  });
  it('rejects malformed persisted appearance and route values', () => {
    const d = exampleDiagram();
    d.edges[0].data = { points: [{ x: 'invalid', y: 1 }] };
    expect(() => parseDiagram(serializeDiagram(d))).toThrow('waypoints');
    d.edges[0].data = { speed: 0 };
    expect(() => parseDiagram(serializeDiagram(d))).toThrow('connection settings');
    delete d.edges[0].data;
    d.nodes[0].data.visuals = { background: 'url(javascript:alert(1))' };
    expect(() => parseDiagram(serializeDiagram(d))).toThrow('visual color');
  });
  it('propagates edited constants through gain and sum into a module input', () => {
    const d = exampleDiagram(); const js = makeNode('javascript', { x: 1000, y: 0 }, 'js');
    d.nodes.push(js); d.edges.push({ id: 'js-input', source: 'sum', sourceHandle: 'out-0', target: 'js', targetHandle: 'in-0' });
    expect(previewSignals(d).js.inputs['in-0']).toBe(2.5);
    d.nodes[0].data.value = '4'; d.nodes[2].data.value = '+-';
    expect(previewSignals(d).js.inputs['in-0']).toBe(7.5);
    expect(previewSignals(d, { js: { 'out-0': 42 } }).js.outputs['out-0']).toBe(42);
  });
  it('passes module outputs to downstream blocks and leaves feedback unresolved', () => {
    const js = makeNode('javascript', { x: 0, y: 0 }, 'js'); const gain = makeNode('gain', { x: 300, y: 0 }, 'gain');
    const c = { nodes: [js, gain], edges: [{ id: 'one', source: 'js', sourceHandle: 'out-0', target: 'gain', targetHandle: 'in-0' }], viewport: { x: 0, y: 0, zoom: 1 } };
    expect(previewSignals(c, { js: { 'out-0': 5 } }).gain.outputs['out-0']).toBe(10);
    c.edges.push({ id: 'feedback', source: 'gain', sourceHandle: 'out-0', target: 'js', targetHandle: 'in-0' });
    const preview = previewSignals(c, { js: { 'out-0': 5 } });
    expect(preview.js.inputs['in-0']).toBeNull(); expect(preview.js.outputs['out-0']).toBeNull(); expect(preview.gain.outputs['out-0']).toBeNull();
  });
  it('creates curved or orthogonal paths through ordered waypoints', () => {
    const ends = { sourceX: 0, sourceY: 0, targetX: 300, targetY: 100, sourcePosition: Position.Right, targetPosition: Position.Left };
    const curved = connectionPath(ends, { route: 'bezier', points: [{ x: 140, y: 200 }] });
    expect(curved).toContain('C'); expect(curved).toContain('140 200'); expect(curved).toContain('300 100');
    const stepped = connectionPath(ends, { route: 'smoothstep', points: [{ x: 140, y: 200 }] });
    expect(stepped).toContain('140 200'); expect(stepped).not.toContain('C');
  });
  it('exports concentric ports, visual visibility and wire geometry without executing modules', () => {
    const d = exampleDiagram(); d.nodes[0].data.visuals = { background: '#fedcba', showHeader: false, showLabel: false, showValue: false, showPortLabels: false };
    d.nodes[0].data.label = 'HIDDEN LABEL'; d.nodes[0].data.value = 'HIDDEN VALUE';
    d.edges[0].data = { route: 'bezier', color: '#abcdef', width: 4, points: [{ x: 250, y: 50 }] };
    const scene = buildScene(d, collectPages(d, [], 'current'), defaultExportOptions);
    expect(scene.body).toContain('fill="#fedcba"'); expect(scene.body).not.toContain('>HIDDEN LABEL<'); expect(scene.body).not.toContain('>HIDDEN VALUE<');
    expect(scene.body).toContain('r="5.5"'); expect(scene.body).toContain('r="2.5"'); expect(scene.body).toContain('stroke="#abcdef" stroke-width="4"');
    expect(scene.wires[0].d).toContain('C'); expect(scene.wires[0].d).toContain('250 50');
  });
});
