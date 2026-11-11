import { controlledPaths, type ControlledPath } from './block-code';
import { isSignal, type Signal } from './runtime';
import type { Port } from './model';
export type ModuleDependency = { specifier: string; url?: string; source?: string };
export type WasmConfig = { filename: string; base64: string; exportName: string };
export type RendererConfig = { precision: number; slice: number; fontSize?: number };
export const validVariable = (name: string) => /^[A-Za-z_$][\w$]{0,63}$/.test(name) && !['__proto__', 'prototype', 'constructor'].includes(name);
export const validSpecifier = (name: string) => /^[A-Za-z@][\w@/.-]{0,127}$/.test(name) && !['__proto__', 'constructor', 'prototype'].includes(name);
export const validModuleUrl = (url: string) => { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } };
export function parseCodeFields(data: Record<string, unknown>, ports: Port[]) {
  const result: { dependencies?: ModuleDependency[]; wasm?: WasmConfig; recipe?: string; renderer?: RendererConfig; render?: string; state?: Record<string, Signal>; controlledProperties?: ControlledPath[] } = {};
  if (data.render !== undefined) { if (typeof data.render !== 'string' || data.render.length > 100000) throw new Error('Invalid render function.'); result.render = data.render; }
  if (data.state !== undefined) { if (!data.state || Array.isArray(data.state) || typeof data.state !== 'object' || !isSignal(data.state)) throw new Error('State must be a bounded JSON object.'); result.state = data.state as Record<string, Signal>; }
  if (data.controlledProperties !== undefined) { if (!Array.isArray(data.controlledProperties) || new Set(data.controlledProperties).size !== data.controlledProperties.length || data.controlledProperties.some(p => !controlledPaths.includes(p))) throw new Error('Invalid code-controlled property.'); result.controlledProperties = data.controlledProperties as ControlledPath[]; }
  for (const type of ['input', 'output']) {
    const names = ports.filter(p => p.type === type).map(p => p.variable).filter(v => v !== undefined);
    for (const port of ports.filter(p => p.type === type)) if (port.variable && ports.some(p => p.type === type && p.id !== port.id && p.id === port.variable)) throw new Error('Variable mapping conflicts with another port ID.');
    if (new Set(names).size !== names.length) throw new Error(`Duplicate ${type} variable mapping.`);
  }
  if (data.recipe !== undefined) {
    if (typeof data.recipe !== 'string' || data.recipe.length > 80) throw new Error('Invalid block recipe.');
    result.recipe = data.recipe;
  }
  if (data.dependencies !== undefined) {
    if (!Array.isArray(data.dependencies) || data.dependencies.length > 32) throw new Error('Invalid module dependencies.');
    const seen = new Set<string>(); let size = 0;
    result.dependencies = data.dependencies.map(d => {
      if (!d || typeof d !== 'object' || typeof d.specifier !== 'string' || !validSpecifier(d.specifier) || seen.has(d.specifier) || (typeof d.url === 'string') === (typeof d.source === 'string')) throw new Error('Each module needs a unique specifier and either a URL or source.');
      seen.add(d.specifier);
      if (d.url !== undefined && (typeof d.url !== 'string' || d.url.length > 2048 || !validModuleUrl(d.url))) throw new Error('Invalid module URL.');
      if (d.source !== undefined && (typeof d.source !== 'string' || d.source.length > 100000)) throw new Error('Invalid dependency source.');
      size += d.source?.length ?? d.url?.length ?? 0;
      if (size > 500000) throw new Error('Module sources exceed 500 KB.');
      return { specifier: d.specifier, ...(d.url !== undefined ? { url: d.url } : { source: d.source }) };
    });
  }
  if (data.wasm !== undefined) {
    const w = data.wasm as WasmConfig;
    if (!w || typeof w.filename !== 'string' || w.filename.length > 255 || typeof w.base64 !== 'string' || w.base64.length > 1400000 || !/^AGFzbQEAAA[A-Za-z0-9+/]*={0,2}$/.test(w.base64) || w.base64.length % 4 || typeof w.exportName !== 'string' || !w.exportName || w.exportName.length > 128) throw new Error('Invalid WebAssembly configuration.');
    if (!WebAssembly.validate(Uint8Array.from(atob(w.base64), c => c.charCodeAt(0)))) throw new Error('Invalid WebAssembly binary.');
    result.wasm = { filename: w.filename, base64: w.base64, exportName: w.exportName };
  }
  if (data.renderer !== undefined) {
    const r = data.renderer as RendererConfig;
    if (!r || !Number.isInteger(r.precision) || r.precision < 0 || r.precision > 12 || !Number.isInteger(r.slice) || r.slice < 0 || r.slice > 10000) throw new Error('Invalid renderer configuration.');
    if (r.fontSize !== undefined && (!Number.isFinite(r.fontSize) || r.fontSize < 10 || r.fontSize > 72)) throw new Error('Invalid renderer font size.');
    result.renderer = { precision: r.precision, slice: r.slice, ...(r.fontSize !== undefined ? { fontSize: r.fontSize } : {}) };
  }
  return result;
}
