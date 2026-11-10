import type { Port, Side } from './model';

export function portOffset(ports: Port[], port: Port): number {
  const group = ports.filter(p => p.side === port.side);
  return port.offset ?? (group.findIndex(p => p.id === port.id) + 1) / (group.length + 1);
}

export function portAtBorder(x: number, y: number, width: number, height: number, ports: Port[] = [], portId?: string): Pick<Port, 'side' | 'offset'> & { snapped?: boolean } {
  const distances: [Side, number][] = [['left', Math.abs(x)], ['right', Math.abs(width - x)], ['top', Math.abs(y)], ['bottom', Math.abs(height - y)]];
  const side = distances.reduce((a, b) => a[1] <= b[1] ? a : b)[0];
  const vertical = side === 'left' || side === 'right';
  const length = vertical ? height : width;
  const margin = Math.min(0.15, 12 / length);
  const offset = Math.max(margin, Math.min(1 - margin, (vertical ? y : x) / length));
  const count = ports.filter(p => p.side === side && p.id !== portId).length + 1;
  const divisions = Math.max(2, count + 1);
  const magnets = [0.5, ...Array.from({ length: divisions - 1 }, (_, i) => (i + 1) / divisions)];
  const nearest = magnets.reduce((a, b) => Math.abs(a - offset) <= Math.abs(b - offset) ? a : b);
  const snapped = Math.abs(nearest - offset) <= Math.min(0.035, 7 / length);
  return { side, offset: snapped ? nearest : offset, ...(snapped ? { snapped: true } : {}) };
}
