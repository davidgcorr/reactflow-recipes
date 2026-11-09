import { getSmoothStepPath, Position } from '@xyflow/react';
import { canvasAt, defaultTheme, type BlockNode, type Canvas, type Diagram, type Port, type Side, type ThemeSettings } from '../model';
import { themeVariables } from '../theme';

export type ExportFormat = 'html' | 'svg' | 'png' | 'gif' | 'json';
export type ExportOptions = { scope: 'current' | 'system'; width: number; transparent: boolean; grid: boolean; title: boolean; animate: boolean };
export const defaultExportOptions: ExportOptions = { scope: 'current', width: 1600, transparent: false, grid: false, title: true, animate: true };
export type ExportPage = { title: string; path: string[]; canvas: Canvas; index: number; parent: number | null };
export type ExportWire = { d: string; x: number; y: number };
export type ExportScene = { width: number; height: number; body: string; wires: ExportWire[]; palette: ExportPalette; title: string };
export type ExportPalette = { background: string; card: string; foreground: string; muted: string; primary: string; border: string; grid: string; secondary: string };
const sides: Record<Side, Position> = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };

export const escapeXml = (text: string) => text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// Explicit sRGB colors make exported SVGs portable to image viewers without OKLCH support.
export function oklchToHex(value: string): string {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) throw new Error('Invalid export theme color.');
  const L = Number(match[1]), C = Number(match[2]), h = Number(match[3]) * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (n: number) => {
    const srgb = n <= 0.0031308 ? 12.92 * n : 1.055 * Math.max(n, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, srgb)) * 255).toString(16).padStart(2, '0');
  };
  return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(encode).join('');
}
export function exportPalette(theme: ThemeSettings): ExportPalette {
  const vars = themeVariables(theme);
  return Object.fromEntries(Object.entries({ background: '--background', card: '--card', foreground: '--foreground', muted: '--muted-foreground', primary: '--primary', border: '--border', grid: '--grid-color', secondary: '--secondary' }).map(([key, token]) => [key, oklchToHex(vars[token])])) as ExportPalette;
}
export function collectPages(diagram: Diagram, path: string[], scope: ExportOptions['scope']): ExportPage[] {
  if (scope === 'current') {
    const parentPath = path.slice(0, -1);
    const title = path.length ? canvasAt(diagram, parentPath).nodes.find(n => n.id === path.at(-1))!.data.label : diagram.name;
    return [{ title, path, canvas: canvasAt(diagram, path), index: 0, parent: null }];
  }
  const pages: ExportPage[] = [];
  function visit(canvas: Canvas, currentPath: string[], title: string, parent: number | null) {
    const index = pages.length; pages.push({ title, path: currentPath, canvas, index, parent });
    for (const node of canvas.nodes) if (node.data.canvas) visit(node.data.canvas, [...currentPath, node.id], `${title} / ${node.data.label}`, index);
  }
  visit(diagram, [], diagram.name, null);
  return pages;
}
export function handlePoint(node: BlockNode, port: Port) {
  const group = node.data.ports.filter(p => p.side === port.side);
  const fraction = (group.findIndex(p => p.id === port.id) + 1) / (group.length + 1);
  const w = node.width ?? 164, h = node.height ?? 116;
  return { x: node.position.x + (port.side === 'left' ? 0 : port.side === 'right' ? w : w * fraction), y: node.position.y + (port.side === 'top' ? 0 : port.side === 'bottom' ? h : h * fraction) };
}
function canvasBounds(canvas: Canvas) {
  if (!canvas.nodes.length) return { x: 0, y: 0, width: 512, height: 200 };
  const x = Math.min(...canvas.nodes.map(n => n.position.x)), y = Math.min(...canvas.nodes.map(n => n.position.y));
  const width = Math.max(...canvas.nodes.map(n => n.position.x + (n.width ?? 164))) - x;
  const height = Math.max(...canvas.nodes.map(n => n.position.y + (n.height ?? 116))) - y;
  if (![x, y, width, height].every(Number.isFinite) || Math.max(width, height) > 10_000_000) throw new Error('This diagram is too spread out to export. Move the blocks closer together.');
  return { x, y, width, height };
}
function renderBlock(node: BlockNode, index: string, palette: ExportPalette, radius: number, destination?: number): string {
  const { data } = node; const w = node.width ?? 164, h = node.height ?? 116;
  const parent = data.kind === 'subsystem', boundary = data.kind === 'inport' || data.kind === 'outport';
  const clip = `block-${index}`; const textClip = `label-${index}`;
  const text = (x: number, y: number, value: string, size: number, attrs = '') => `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${escapeXml(value)}</text>`;
  let symbol: string;
  if (parent) {
    symbol = `<g transform="translate(${w / 2 - 45} ${h / 2 - 13})" fill="${palette.secondary}" stroke="${palette.primary}"><path d="M24 10h42" fill="none"/>${[0, 34, 68].map(x => `<rect x="${x}" y="0" width="22" height="20" rx="3"/>`).join('')}</g>`;
  } else if (data.kind === 'scope') symbol = `<path d="M-27 6h8l8-15 10 17 10-12 8 7h10" transform="translate(${w / 2} ${h / 2})" fill="none" stroke="${palette.primary}" stroke-width="1.5" stroke-linejoin="round"/>`;
  else symbol = text(w / 2, h / 2 + 8, boundary ? data.kind === 'inport' ? '↳' : '↗' : data.kind === 'gain' ? `× ${data.value}` : data.value || 'ƒ', 29, `text-anchor="middle" fill="${palette.primary}" font-family="Georgia,serif" clip-path="url(#${clip})"`);
  const ports = data.ports.map(port => {
    const absolute = handlePoint(node, port); const x = absolute.x - node.position.x, y = absolute.y - node.position.y;
    const left = port.side === 'left', right = port.side === 'right', top = port.side === 'top';
    return `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1" fill="${port.type === 'input' ? palette.card : palette.primary}" stroke="${palette.primary}"/>` + text(left ? x + 10 : right ? x - 10 : x, left || right ? y + 2 : top ? y + 15 : y - 9, port.name, 7, `text-anchor="${left ? 'start' : right ? 'end' : 'middle'}" fill="${palette.muted}" clip-path="url(#${clip})"`);
  }).join('');
  const interactive = destination === undefined ? '' : ` data-enter="${destination}" role="button" tabindex="0" aria-label="${escapeXml(`Enter ${data.label}`)}" style="cursor:pointer"`;
  return `<g transform="translate(${node.position.x} ${node.position.y})"${interactive}><title>${escapeXml(data.label + (data.description ? ': ' + data.description : ''))}</title><defs><clipPath id="${clip}"><rect x="6" y="5" width="${w - 12}" height="${h - 10}"/></clipPath><clipPath id="${textClip}"><rect x="12" y="${h - 28}" width="${w - 24}" height="24"/></clipPath></defs><rect width="${w}" height="${h}" rx="${Math.min(radius, w / 2, h / 2)}" fill="${palette.card}" stroke="${palette.border}"${boundary ? ' stroke-dasharray="4 3"' : ''}/>${text(12, 18, parent ? 'PARENT' : boundary ? `${data.kind === 'inport' ? 'INPUT' : 'OUTPUT'} PORT` : data.kind.toUpperCase(), 7, `letter-spacing="0.8" fill="${palette.muted}" clip-path="url(#${clip})"`)}${parent ? `<rect x="${w - 29}" y="8" width="17" height="16" rx="3" fill="${palette.secondary}"/>${text(w - 20.5, 19, String(data.canvas?.nodes.length ?? 0), 8, `text-anchor="middle" fill="${palette.muted}"`)}` : ''}${symbol}${text(w / 2, h - 12, data.label, 10, `text-anchor="middle" fill="${palette.muted}" clip-path="url(#${textClip})"`)}${parent ? `<path d="m${w - 20} ${h - 20} 4 4-4 4" fill="none" stroke="${palette.muted}" stroke-width="1.2"/>` : ''}${ports}</g>`;
}
export function buildScene(diagram: Diagram, pages: ExportPage[], options: ExportOptions, interactive = false): ExportScene {
  const theme = diagram.theme ?? defaultTheme; const palette = exportPalette(theme);
  const sheets = pages.map(page => ({ ...page, bounds: canvasBounds(page.canvas) }));
  const width = Math.max(400, ...sheets.map(s => s.bounds.width + 128));
  const wires: ExportWire[] = []; let yOffset = 0;
  const body = sheets.map(sheet => {
    const heading = options.title || sheets.length > 1 ? 44 : 0;
    const sheetHeight = sheet.bounds.height + 128 + heading;
    const x = (width - sheet.bounds.width) / 2 - sheet.bounds.x;
    const y = yOffset + 64 + heading - sheet.bounds.y;
    const byId = new Map(sheet.canvas.nodes.map(n => [n.id, n]));
    const paths = sheet.canvas.edges.map(edge => {
      const source = byId.get(edge.source), target = byId.get(edge.target);
      const out = source?.data.ports.find(p => p.id === edge.sourceHandle), input = target?.data.ports.find(p => p.id === edge.targetHandle);
      if (!source || !target || !out || !input) return '';
      const a = handlePoint(source, out), b = handlePoint(target, input);
      const [d] = getSmoothStepPath({ sourceX: a.x, sourceY: a.y, sourcePosition: sides[out.side], targetX: b.x, targetY: b.y, targetPosition: sides[input.side], borderRadius: 5 });
      wires.push({ d, x, y });
      return `<path d="${d}" fill="none" stroke="${palette.muted}" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    }).join('');
    const blocks = sheet.canvas.nodes.map((node, i) => renderBlock(node, `${sheet.index}-${i}`, palette, theme.radius - 1, interactive ? pages.find(p => p.path.length === sheet.path.length + 1 && p.path.slice(0, -1).every((id, j) => id === sheet.path[j]) && p.path.at(-1) === node.id)?.index : undefined)).join('');
    const title = heading ? `<text x="32" y="${yOffset + 36}" font-size="13" font-weight="600" fill="${palette.foreground}">${escapeXml(sheet.title)}</text><path d="M32 ${yOffset + 52}H${width - 32}" stroke="${palette.border}"/>` : '';
    const separator = yOffset ? `<path d="M0 ${yOffset}H${width}" stroke="${palette.border}"/>` : '';
    const empty = sheet.canvas.nodes.length ? '' : `<text x="${width / 2}" y="${yOffset + sheetHeight / 2}" text-anchor="middle" font-size="14" fill="${palette.muted}">Empty canvas</text>`;
    yOffset += sheetHeight;
    return `${separator}${title}<g transform="translate(${x} ${y})">${paths}${blocks}</g>${empty}`;
  }).join('');
  return { width, height: Math.max(200, yOffset), body, wires, palette, title: pages[0]?.title || diagram.name };
}
export function rasterSize(scene: Pick<ExportScene, 'width' | 'height'>, requestedWidth: number, format: 'png' | 'gif' = 'png') {
  const limit = format === 'gif' ? 2_000_000 : 16_000_000;
  const scale = Math.min(Math.max(320, Math.min(requestedWidth, format === 'gif' ? 1600 : 4096)) / scene.width, 8192 / scene.height, Math.sqrt(limit / (scene.width * scene.height)));
  return { width: Math.max(1, Math.round(scene.width * scale)), height: Math.max(1, Math.round(scene.height * scale)), scale };
}
export function sceneSvg(scene: ExportScene, options: Pick<ExportOptions, 'transparent' | 'grid'>, size?: { width: number; height: number }): string {
  const { palette: p, width, height } = scene;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size?.width ?? width}" height="${size?.height ?? height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="diagram-title" font-family="Inter,Arial,Helvetica,sans-serif"><title id="diagram-title">${escapeXml(scene.title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9z" fill="${p.muted}"/></marker><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="${p.grid}"/></pattern></defs>${options.transparent ? '' : `<rect width="${width}" height="${height}" fill="${p.background}"/>`}${options.grid ? `<rect width="${width}" height="${height}" fill="url(#grid)"/>` : ''}${scene.body}</svg>`;
}
export function exportFilename(name: string, extension: ExportFormat): string {
  const base = name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'milver';
  return `${base}.${extension}`;
}
