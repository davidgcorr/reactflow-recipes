import { describe, expect, it } from 'vitest';
import { exampleDiagram, makeNode } from '../model';
import { buildScene, collectPages, defaultExportOptions, escapeXml, exportFilename, exportPalette, handlePoint, oklchToHex, rasterSize, safeJson, sceneSvg } from './scene';
import { exportHtml } from './html';
import { createExport } from './download';

const options = defaultExportOptions;
describe('publication exports', () => {
  it('includes every block regardless of viewport and excludes editor state', () => {
    const d = exampleDiagram(); d.nodes[0].position = { x: -2000, y: 1500 }; d.viewport = { x: 8000, y: 9000, zoom: 0.2 }; d.nodes[0].selected = true;
    const scene = buildScene(d, collectPages(d, [], 'current'), options);
    const svg = sceneSvg(scene, options);
    expect(scene.width).toBeGreaterThan(3000);
    for (const n of d.nodes) expect(svg).toContain(n.data.label);
    expect(svg).not.toContain('foreignObject'); expect(svg).not.toContain('selected');
    expect(svg).not.toContain('Inspector'); expect(svg).not.toContain('localStorage');
    expect(scene.wires).toHaveLength(4);
  });
  it('maps ports to the same evenly-spaced positions used in the editor', () => {
    const node = makeNode('sum', { x: -40, y: 60 });
    expect(handlePoint(node, node.data.ports[0])).toEqual({ x: -40, y: 60 + 116 / 3 });
    node.data.ports[0].side = 'top';
    expect(handlePoint(node, node.data.ports[0])).toEqual({ x: 42, y: 60 });
    node.data.ports[0].side = 'bottom';
    expect(handlePoint(node, node.data.ports[0])).toEqual({ x: 42, y: 176 });
  });
  it('exports separate labeled sheets for the entire nested system', () => {
    const d = exampleDiagram(); const parent = makeNode('subsystem', { x: 0, y: 600 }, 'parent'); d.nodes.push(parent);
    const nested = collectPages(d, ['parent'], 'current');
    expect(nested).toHaveLength(1); expect(nested[0].canvas).toBe(parent.data.canvas);
    const all = collectPages(d, ['parent'], 'system');
    expect(all).toHaveLength(2); expect(all[1].parent).toBe(0);
    const scene = buildScene(d, all, options);
    expect(scene.body).toContain('Signal processing / Parent block');
    expect(scene.wires).toHaveLength(6);
  });
  it('converts the monochrome theme to portable RGB colors', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
    expect(exportPalette({ mode: 'light', hue: 0, chroma: 0, radius: 10 }).primary).toBe('#171717');
    expect(exportPalette({ mode: 'dark', hue: 255, chroma: 0.17, radius: 10 }).primary).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('supports transparent backgrounds and optional grids without affecting block fills', () => {
    const d = exampleDiagram(); const scene = buildScene(d, collectPages(d, [], 'current'), options);
    const svg = sceneSvg(scene, { transparent: true, grid: false });
    expect(svg).not.toContain(`<rect width="${scene.width}" height="${scene.height}"`);
    expect(svg).toContain('fill="#ffffff"');
    expect(sceneSvg(scene, { transparent: false, grid: true })).toContain('fill="url(#grid)"');
  });
  it('bounds image dimensions and GIF memory requirements', () => {
    const png = rasterSize({ width: 1000, height: 500 }, 2400);
    expect(png.width).toBe(2400); expect(png.height).toBe(1200);
    const huge = rasterSize({ width: 20000, height: 100000 }, 4096);
    expect(huge.width * huge.height).toBeLessThanOrEqual(16_010_000); expect(huge.height).toBeLessThanOrEqual(8192);
    const gif = rasterSize({ width: 1000, height: 500 }, 4096, 'gif');
    expect(gif.width).toBe(1600);
  });
  it('builds offline HTML with keyboard navigation and parent links', () => {
    const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { x: 0, y: 600 }, 'parent'));
    const html = exportHtml(d, [], { ...options, scope: 'system' });
    expect(html).toContain('data-enter="1"'); expect(html).toContain('id="arrow-0"'); expect(html).toContain('id="arrow-1"');
    expect(html).toContain('url(#arrow-1)'); expect(html).toContain('MIT License');
    expect(html).not.toContain('<script src='); expect(html).not.toContain('fetch(');
    expect(html).toContain("event.key==='Escape'");
    expect(exportHtml(d, [], options)).not.toContain('data-enter="1"');
  });
  it('escapes untrusted diagram content in SVG, HTML and embedded JSON', () => {
    const attack = '</script><script>alert("x")</script><img src=x onerror=alert(1)>';
    const d = exampleDiagram(); d.name = attack; d.nodes[0].data.label = attack; d.nodes[0].data.description = attack;
    const html = exportHtml(d, [], options);
    expect(html).not.toContain(attack); expect(html).toContain('&lt;/script&gt;');
    expect(safeJson({ title: attack })).not.toContain('<');
    expect(escapeXml('"<&')).toBe('&quot;&lt;&amp;');
  });
  it('returns genuine SVG, HTML and JSON files with correct MIME types', async () => {
    for (const [format, mime] of [['svg', 'image/svg+xml'], ['html', 'text/html'], ['json', 'application/json']] as const) {
      const result = await createExport(exampleDiagram(), [], format, options);
      expect(result.blob.type).toContain(mime); expect(result.filename).toBe(`signal-processing.${format}`);
      const text = await result.blob.text();
      if (format === 'svg') expect(text).toMatch(/^<svg/);
      if (format === 'html') expect(text).toMatch(/^<!doctype html>/);
      if (format === 'json') expect(JSON.parse(text).nodes).toHaveLength(5);
    }
    expect(exportFilename(' <weird / name> ', 'png')).toBe('weird-name.png');
  });
  it('handles empty canvases and rejects unrenderable geometry', () => {
    const d = exampleDiagram(); d.nodes = []; d.edges = [];
    expect(buildScene(d, collectPages(d, [], 'current'), options).body).toContain('Empty canvas');
    d.nodes.push(makeNode('gain', { x: -1e308, y: 0 }), makeNode('gain', { x: 1e308, y: 0 }));
    expect(() => buildScene(d, collectPages(d, [], 'current'), options)).toThrow('too spread out');
  });
});

it('produces a syntactically valid standalone HTML viewer for the nested example', async () => {
  const { readFileSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { Script } = await import('node:vm');
  const { parseDiagram } = await import('../model');
  const diagram = parseDiagram(readFileSync('examples/parent-block.json', 'utf8'));
  const html = exportHtml(diagram, [], { ...options, scope: 'system' });
  const script = html.match(/<script>\n([\s\S]*?)<\/script>/)![1];
  expect(() => new Script(script)).not.toThrow();
  expect(html).toContain('data-enter="1"');
  // Optional local artifact generation for manual browser QA; normal test runs write nothing.
  const directory = process.env.MILVER_EXPORT_QA_DIR;
  if (directory) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/nested-controller.html`, html);
    writeFileSync(`${directory}/nested-controller.svg`, sceneSvg(buildScene(diagram, collectPages(diagram, [], 'system'), options), options));
  }
});

it('links the correct parent even when blocks occupy identical positions', () => {
  const d = exampleDiagram(); d.nodes.push(makeNode('subsystem', { ...d.nodes[0].position }, 'overlapping-parent'));
  const html = exportHtml(d, [], { ...options, scope: 'system' });
  expect(html).toContain('<g data-block="0-5" data-enter="1"');
  expect(html).not.toContain('<g data-block="0-0" data-enter=');
});
