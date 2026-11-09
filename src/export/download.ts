import type { Diagram } from '../model';
import { serializeDiagram } from '../model';
import { exportHtml } from './html';
import { buildScene, collectPages, exportFilename, rasterSize, sceneSvg, type ExportFormat, type ExportOptions, type ExportScene } from './scene';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  // Give browsers time to start reading a download before revoking its URL.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render the diagram image. Try exporting SVG.')); image.src = url; });
    return image;
  } finally { URL.revokeObjectURL(url); }
}
async function rasterize(scene: ExportScene, options: ExportOptions, format: 'png' | 'gif') {
  const size = rasterSize(scene, options.width, format);
  const image = await loadSvg(sceneSvg(scene, { ...options, transparent: format === 'gif' ? false : options.transparent }, size));
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d', { willReadFrequently: format === 'gif' });
  if (!context) throw new Error('Your browser could not create an image canvas. Try exporting SVG.');
  context.drawImage(image, 0, 0, size.width, size.height);
  return { canvas, context, image, size };
}
export async function renderPng(scene: ExportScene, options: ExportOptions): Promise<Blob> {
  const { canvas } = await rasterize(scene, options, 'png');
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode PNG. Try a smaller width.')), 'image/png'));
}
export async function renderGif(scene: ExportScene, options: ExportOptions, onProgress: (progress: number) => void): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const { context, image, size } = await rasterize(scene, options, 'gif');
  const encoder = GIFEncoder(); const frames = options.animate && scene.wires.length ? 24 : 1;
  const paths = scene.wires.map(wire => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', wire.d);
    return { ...wire, path, length: path.getTotalLength() };
  });
  let palette: number[][] | undefined;
  for (let frame = 0; frame < frames; frame++) {
    context.drawImage(image, 0, 0, size.width, size.height);
    if (frames > 1) {
      context.fillStyle = scene.palette.primary;
      for (const wire of paths) {
        const point = wire.path.getPointAtLength((frame / frames) * wire.length);
        context.beginPath(); context.arc((point.x + wire.x) * size.scale, (point.y + wire.y) * size.scale, Math.max(2, 3 * size.scale), 0, Math.PI * 2); context.fill();
      }
    }
    const rgba = context.getImageData(0, 0, size.width, size.height).data;
    if (!palette) palette = quantize(rgba, 256);
    encoder.writeFrame(applyPalette(rgba, palette), size.width, size.height, { ...(frame === 0 ? { palette } : {}), delay: frames > 1 ? 80 : 0, repeat: 0, dispose: 1 });
    onProgress(Math.round((frame + 1) / frames * 100));
    // Yield between frames so the dialog and progress indicator remain responsive.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  encoder.finish();
  return new Blob([new Uint8Array(encoder.bytes())], { type: 'image/gif' });
}
export async function createExport(diagram: Diagram, path: string[], format: ExportFormat, options: ExportOptions, onProgress = (_value: number) => {}): Promise<{ blob: Blob; filename: string }> {
  if (format === 'json') return { blob: new Blob([serializeDiagram(diagram)], { type: 'application/json' }), filename: exportFilename(diagram.name, format) };
  const pages = collectPages(diagram, path, options.scope);
  const scene = buildScene(diagram, pages, options);
  let blob: Blob;
  if (format === 'html') blob = new Blob([exportHtml(diagram, path, options)], { type: 'text/html;charset=utf-8' });
  else if (format === 'svg') blob = new Blob([sceneSvg(scene, options)], { type: 'image/svg+xml;charset=utf-8' });
  else if (format === 'png') blob = await renderPng(scene, options);
  else blob = await renderGif(scene, options, onProgress);
  return { blob, filename: exportFilename(scene.title, format) };
}
