import { getBezierPath, getSmoothStepPath, Position } from '@xyflow/react';
import type { FlowSettings } from './model';
export type PathEnds = { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position };
export function connectionPath(ends: PathEnds, settings: FlowSettings = {}): string {
  const points = settings.points ?? [];
  if (!points.length) return (settings.route === 'bezier' ? getBezierPath(ends) : getSmoothStepPath({ ...ends, borderRadius: 8 }))[0];
  const all = [{ x: ends.sourceX, y: ends.sourceY }, ...points, { x: ends.targetX, y: ends.targetY }];
  if (settings.route !== 'bezier') return all.slice(0, -1).map((p, i) => {
    const q = all[i + 1];
    const horizontal = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y);
    const direction = horizontal ? q.x >= p.x ? Position.Right : Position.Left : q.y >= p.y ? Position.Bottom : Position.Top;
    const opposite = { left: Position.Right, right: Position.Left, top: Position.Bottom, bottom: Position.Top };
    const [path] = getSmoothStepPath({ sourceX: p.x, sourceY: p.y, targetX: q.x, targetY: q.y, sourcePosition: i === 0 ? ends.sourcePosition : direction, targetPosition: i === all.length - 2 ? ends.targetPosition : opposite[direction], borderRadius: 8 });
    return i ? path.replace(/^M/, 'L') : path;
  }).join(' ');
  // Catmull–Rom to cubic Bézier: the curve passes through every editable waypoint.
  let path = `M ${all[0].x} ${all[0].y}`;
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[Math.max(0, i - 1)], b = all[i], c = all[i + 1], d = all[Math.min(all.length - 1, i + 2)];
    path += ` C ${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6}, ${c.x - (d.x - b.x) / 6} ${c.y - (d.y - b.y) / 6}, ${c.x} ${c.y}`;
  }
  return path;
}
