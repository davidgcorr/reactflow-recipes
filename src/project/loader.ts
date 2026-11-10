import { init, parse } from 'es-module-lexer';
import type { ProjectModule } from './schema';
import type { ModuleDependency } from '../code-config';
export type Namespace = Record<string, unknown>;
export class ModuleLoader {
  private urls = new Set<string>();
  private sources = new Map<string, string>();
  private resolved = new Map<string, Promise<string>>();
  constructor(private definitions: ProjectModule[], private transport?: { createURL: (source: string) => string; importURL?: (url: string) => Promise<Namespace> }) {
    for (const m of definitions) {
      if (m.source !== undefined) this.sources.set(m.alias, m.source);
      for (const d of m.dependencies ?? []) if (d.source !== undefined) {
        const existing = this.sources.get(d.specifier); if (existing !== undefined && existing !== d.source) throw new Error(`Conflicting project dependency: ${d.specifier}`);
        this.sources.set(d.specifier, d.source);
      }
    }
  }
  private dependency(name: string, base?: string): ModuleDependency | undefined {
    const module = this.definitions.find(m => m.alias === name || !base && m.filename && (name === `./${m.filename}` || name === m.filename)); if (module) return { specifier: module.alias, source: module.source, url: module.url };
    const matches = this.definitions.flatMap(m => m.dependencies ?? []).filter(d => d.specifier === name);
    if (matches.some(d => JSON.stringify(d) !== JSON.stringify(matches[0]))) throw new Error(`Conflicting project dependency: ${name}`);
    return matches[0];
  }
  async resolve(name: string, base?: string, chain: string[] = []): Promise<string> {
    const dep = this.dependency(name, base);
    const key = dep ? dep.url ?? dep.specifier : base ? new URL(name, base).href : name;
    if (chain.includes(key)) throw new Error(`Circular module dependency: ${[...chain, key].join(' → ')}. Combine cyclic local modules.`);
    const cached = this.resolved.get(key); if (cached) return cached;
    const task = (async () => {
      let source = this.sources.get(key), sourceUrl = dep?.url;
      if (source === undefined) {
        sourceUrl ??= key;
        if (!/^https?:\/\//.test(sourceUrl)) throw new Error(`Unknown module '${name}'. Import it into the project or use an absolute ES module URL.`);
        const response = await fetch(sourceUrl, { credentials: 'omit' });
        if (!response.ok) throw new Error(`Loading ${sourceUrl}: HTTP ${response.status}`);
        source = await response.text(); sourceUrl = response.url || sourceUrl;
        if (source.length > 2000000) throw new Error('Remote module exceeds 2 MB.');
      }
      return this.compile(source, sourceUrl, [...chain, key]);
    })();
    this.resolved.set(key, task); return task;
  }
  async compile(source: string, base?: string, chain: string[] = []): Promise<string> {
    await init;
    const [imports] = parse(source);
    const edits: { start: number; end: number; value: string }[] = [];
    for (const entry of imports) {
      if (entry.d === -2) { if (base) edits.push({ start: entry.s, end: entry.e, value: `({url:${JSON.stringify(base)}})` }); continue; }
      if (entry.n === undefined) throw new Error('Dynamic import specifiers must be string literals in project modules.');
      const url = await this.resolve(entry.n, base, chain);
      edits.push({ start: entry.s, end: entry.e, value: entry.d >= 0 ? JSON.stringify(url) : url });
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
    const url = this.transport ? this.transport.createURL(source) : URL.createObjectURL(new Blob([source], { type: 'text/javascript' })); this.urls.add(url); return url;
  }
  async load() {
    const modules: Record<string, Namespace> = Object.create(null);
    for (const definition of this.definitions) modules[definition.alias] = await this.importURL(await this.resolve(definition.alias));
    return modules;
  }
  private async importURL(url: string): Promise<Namespace> { return this.transport?.importURL ? this.transport.importURL(url) : import(/* @vite-ignore */ url); }
  async code(source: string) { return this.importURL(await this.compile(source)); }
  dispose() { if (!this.transport) for (const url of this.urls) URL.revokeObjectURL(url); this.urls.clear(); this.resolved.clear(); }
}
