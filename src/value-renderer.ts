import type { Signal } from './runtime';
export type ValueView = { kind: string; shape: number[]; rows: Signal[][]; slices: number; slice: number; error?: string };
function shapeOf(value: Signal): number[] | null {
  if (!Array.isArray(value)) return typeof value === 'number' ? [] : null;
  if (!value.length) return [0];
  const first = shapeOf(value[0]);
  if (!first || value.some(v => JSON.stringify(shapeOf(v)) !== JSON.stringify(first))) return null;
  return [value.length, ...first];
}
export function describeValue(value: Signal, requestedSlice = 0): ValueView {
  if (value && !Array.isArray(value) && typeof value === 'object' && typeof value.$ref === 'string' && Array.isArray(value.rows) && Array.isArray(value.shape)) return { kind: String(value.type), shape: value.shape as number[], rows: value.rows as Signal[][], slices: Number(value.slices ?? 1), slice: Number(value.slice ?? 0) };
  if (value && !Array.isArray(value) && typeof value === 'object' && typeof value.$ref === 'string') return { kind: String(value.type ?? 'Object'), shape: [], rows: [[value.properties ?? value.$ref]], slices: 1, slice: 0 };
  let shape: number[] = [], flat: Signal[] = [];
  if (value && !Array.isArray(value) && typeof value === 'object' && Array.isArray(value.shape) && Array.isArray(value.data)) {
    if (!value.shape.length || !value.shape.every(n => typeof n === 'number' && Number.isInteger(n) && n > 0) || value.shape.reduce<number>((a, b) => a * (b as number), 1) !== value.data.length || !value.data.every(x => typeof x === 'number')) return { kind: 'Invalid tensor', shape: [], rows: [], slices: 1, slice: 0, error: 'Tensor shape must match its numeric data.' };
    shape = value.shape as number[]; flat = value.data;
  } else if (Array.isArray(value)) {
    const inferred = shapeOf(value);
    if (!inferred) return { kind: 'Invalid array', shape: [], rows: [], slices: 1, slice: 0, error: 'Expected a rectangular numeric array.' };
    shape = inferred;
    const flatten = (v: Signal): void => { if (Array.isArray(v)) v.forEach(flatten); else flat.push(v); }; flatten(value);
  } else return { kind: typeof value === 'number' ? 'Number' : value === null ? 'No signal' : 'Value', shape: [], rows: [[value]], slices: 1, slice: 0 };
  const columns = shape.at(-1) ?? 1, rowCount = shape.length > 1 ? shape.at(-2)! : 1;
  const size = columns * rowCount, slices = size ? Math.max(1, flat.length / size) : 1;
  const slice = Math.max(0, Math.min(slices - 1, requestedSlice));
  const rows = Array.from({ length: Math.min(32, rowCount) }, (_, i) => flat.slice(slice * size + i * columns, slice * size + i * columns + Math.min(32, columns)));
  return { kind: shape.length === 1 ? 'Vector' : shape.length === 2 ? 'Matrix' : 'Tensor', shape, rows, slices, slice };
}
export function formatValue(value: Signal, precision: number): string {
  return typeof value === 'number' ? Number(value.toFixed(precision)).toString() : value === null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}
