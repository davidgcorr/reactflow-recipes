// JSON has no infinity literal. Preserve it explicitly instead of silently writing null.
export function signalReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    if (Number.isNaN(value)) throw new Error('NaN is not a supported signal.');
    return { $number: value < 0 ? '-Infinity' : 'Infinity' };
  }
  return value;
}
export function signalReviver(_key: string, value: unknown): any {
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && '$number' in value) {
    if (value.$number === 'Infinity') return Infinity;
    if (value.$number === '-Infinity') return -Infinity;
  }
  return value;
}
export const stringifySignal = (value: unknown, space?: number): string => JSON.stringify(value, signalReplacer, space);
export const parseSignal = (value: string): any => JSON.parse(value, signalReviver);
