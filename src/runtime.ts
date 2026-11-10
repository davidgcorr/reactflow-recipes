import type { Canvas } from './model';
export type Signal = number | string | boolean | null | Signal[] | { [key: string]: Signal };
// Bound messages from sandboxed modules, including cyclic or oversized structures.
export function isSignal(value: unknown): value is Signal {
  let budget = 12000;
  const seen = new Set<object>();
  function visit(v: unknown, depth: number): boolean {
    if (--budget < 0 || depth > 12) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'string') return v.length <= 10000;
    if (typeof v !== 'object' || !v || seen.has(v)) return false;
    seen.add(v);
    const result = Array.isArray(v) ? v.every(x => visit(x, depth + 1)) : Object.getPrototypeOf(v) === Object.prototype && Object.entries(v).every(([k, x]) => !['__proto__', 'constructor', 'prototype'].includes(k) && k.length <= 128 && visit(x, depth + 1));
    seen.delete(v); return result;
  }
  return visit(value, 0);
}
export const signalsEqual = (a: Signal | undefined, b: Signal | undefined) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
export type Signals = Record<string, Signal>;
export type Preview = Record<string, { inputs: Signals; outputs: Signals }>;
// A small acyclic value preview for reusable recipes, without time-domain simulation.
export function previewSignals(canvas: Canvas, emitted: Record<string, Signals> = {}): Preview {
  const result: Preview = {}, stack: string[] = [], cyclic = new Set<string>();
  const visit = (id: string): Signals => {
    if (stack.includes(id)) { stack.slice(stack.indexOf(id)).forEach(id => cyclic.add(id)); return {}; }
    if (result[id]) return result[id].outputs;
    const node = canvas.nodes.find(n => n.id === id); if (!node) return {};
    stack.push(id);
    const inputs: Signals = {};
    for (const port of node.data.ports.filter(p => p.type === 'input')) {
      const edge = canvas.edges.find(e => e.target === id && e.targetHandle === port.id);
      inputs[port.id] = edge ? visit(edge.source)[edge.sourceHandle ?? ''] ?? null : null;
    }
    stack.pop();
    const values = Object.values(inputs), first = values[0] ?? null;
    const numeric = Number(node.data.value);
    let value: Signal = null;
    if (node.data.kind === 'constant') value = Number.isFinite(numeric) ? numeric : node.data.value;
    if (node.data.kind === 'gain' && typeof first === 'number' && Number.isFinite(numeric)) value = first * numeric;
    if (node.data.kind === 'sum' && values.length && values.every(v => typeof v === 'number')) value = values.reduce<number>((a, v, i) => a + (node.data.value[i] === '-' ? -1 : 1) * (v as number), 0);
    if (typeof value === 'number' && !Number.isFinite(value)) value = null;
    const outputs = Object.fromEntries(node.data.ports.filter(p => p.type === 'output').map(p => [p.id, cyclic.has(id) ? null : node.data.kind === 'javascript' ? emitted[id]?.[p.id] ?? null : value]));
    result[id] = { inputs: cyclic.has(id) ? Object.fromEntries(Object.keys(inputs).map(k => [k, null])) : inputs, outputs };
    return outputs;
  };
  canvas.nodes.forEach(n => visit(n.id)); return result;
}
