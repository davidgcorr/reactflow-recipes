import type { ProjectPlan, RuntimeNode } from './graph';
import type { Namespace } from './loader';
import { isSignal, type Signal, type Signals } from '../runtime';
export type ExportInfo = { name: string; kind: 'function' | 'class' | 'value'; args: string[]; methods: { name: string; args: string[] }[] };
export type ModuleInfo = { id: string; alias: string; exports: ExportInfo[] };
export type NodeResult = { inputs: Signals; outputs: Signals; status: 'ok' | 'idle' | 'blocked' | 'error'; error?: string; ms: number; cached: boolean };
export type ExecutionResult = { nodes: Record<string, NodeResult>; tick: number; ms: number; catalog: ModuleInfo[] };
export type ExternalValue = { values: Record<string, unknown>; events?: Record<string, number> };
type Cell = { outputs: Record<string, unknown>; signature: string; events: Record<string, number>; status: NodeResult['status']; error?: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
const safeMember = (name: string) => { if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('That member is not callable.'); return name; };
export function inspectExports(namespace: Namespace): ExportInfo[] {
  const hints = record(namespace.milver) ? namespace.milver : {};
  const args = (fn: Function, hint: unknown) => record(hint) && Array.isArray(hint.args) && hint.args.length <= 32 && hint.args.every(n => typeof n === 'string' && n.length <= 64) ? hint.args as string[] : Array.from({ length: Math.min(32, fn.length) }, (_, i) => `arg${i + 1}`);
  return Object.entries(namespace).filter(([name]) => name !== 'milver').slice(0, 128).map(([name, value]) => {
    const hint = hints[name];
    const methods: ExportInfo['methods'] = [];
    if (typeof value === 'function' && value.prototype) {
      let proto = value.prototype; const seen = new Set<string>();
      while (proto && proto !== Object.prototype && methods.length < 64) {
        for (const [member, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) if (member !== 'constructor' && !seen.has(member) && typeof descriptor.value === 'function') {
          seen.add(member); methods.push({ name: member, args: args(descriptor.value, record(hint) && record(hint.methods) ? hint.methods[member] : undefined) });
        }
        proto = Object.getPrototypeOf(proto);
      }
    }
    const kind = typeof value !== 'function' ? 'value' : /^class\b/.test(Function.prototype.toString.call(value)) || methods.length || record(hint) && hint.kind === 'class' ? 'class' : 'function';
    return { name, kind, args: typeof value === 'function' ? args(value, hint) : [], methods };
  });
}
export class ProjectEngine {
  private cache = new Map<string, Cell>();
  private objects = new WeakMap<object, number>();
  private revisions = new WeakMap<object, number>();
  private nextObject = 0;
  private states = new Map<string, Record<string, unknown>>();
  private code = new Map<string, Namespace>();
  private disposed = new WeakSet<object>();
  private clockStart = Date.now();
  private tick = 0;
  readonly catalog: ModuleInfo[];
  constructor(private modules: Record<string, Namespace>, definitions: ProjectPlan['modules'], private generation: string = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
    this.catalog = definitions.map(m => ({ id: m.id, alias: m.alias, exports: inspectExports(modules[m.alias] ?? {}) }));
  }
  setCode(id: string, namespace: Namespace) { this.code.set(id, namespace); }
  private identity(value: unknown): string {
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      const object = value as object;
      if (!this.objects.has(object)) this.objects.set(object, ++this.nextObject);
      return `@${this.objects.get(object)}:${this.revisions.get(object) ?? 0}`;
    }
    return `${typeof value}:${String(value)}`;
  }
  private mutate(value: unknown) { if (record(value)) this.revisions.set(value, (this.revisions.get(value) ?? 0) + 1); }
  private async release(value: unknown) {
    if (!record(value) || this.disposed.has(value)) return;
    this.disposed.add(value);
    const disposer = typeof value.dispose === 'function' ? value.dispose : typeof value.destroy === 'function' ? value.destroy : undefined;
    if (disposer) await Reflect.apply(disposer, value, []);
  }
  snapshot(value: unknown, slice = 0, depth = 0): Signal {
    try { return this.describeSnapshot(value, slice, depth); } catch { return '[Uninspectable value]'; }
  }
  private describeSnapshot(value: unknown, slice = 0, depth = 0): Signal {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string') return value.slice(0, 10000);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value !== 'object' && typeof value !== 'function') return String(value);
    if (Array.isArray(value) && isSignal(value)) return value;
    const identity = this.identity(value);
    const ref = `${this.generation}/${identity.split(':')[0]}`;
    if (depth > 2) return { $ref: ref, type: 'Object' };
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const tensorShape = descriptors.shape?.value, tensorData = descriptors.data?.value;
    const shaped = Array.isArray(tensorShape) && (Array.isArray(tensorData) || ArrayBuffer.isView(tensorData));
    if (shaped && Array.isArray(tensorData) && isSignal(value)) return value;
    const shape: number[] = [];
    let first: unknown = value;
    if (shaped) shape.push(...(tensorShape as number[]).slice(0, 12));
    else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) shape.push((value as unknown as { length: number }).length);
    else while (Array.isArray(first) && shape.length < 12) { shape.push(first.length); first = first[0]; }
    if (shape.length && shape.every(n => Number.isInteger(n) && n >= 0)) {
      const columns = shape.at(-1)!, rowCount = shape.length > 1 ? shape.at(-2)! : 1;
      const slices = Math.max(1, shape.slice(0, -2).reduce((a, b) => a * b, 1));
      slice = Math.max(0, Math.min(slices - 1, slice));
      const read = (index: number): unknown => {
        if (shaped) return (tensorData as ArrayLike<unknown>)[index];
        if (ArrayBuffer.isView(value)) return (value as unknown as ArrayLike<unknown>)[index];
        let current: unknown = value;
        for (let axis = 0; axis < shape.length; axis++) { const stride = shape.slice(axis + 1).reduce((a, b) => a * b, 1); const coordinate = stride ? Math.floor(index / stride) : 0; index = stride ? index % stride : 0; current = (current as unknown[])?.[coordinate]; }
        return current;
      };
      const rows = Array.from({ length: Math.min(32, rowCount) }, (_, i) => Array.from({ length: Math.min(32, columns) }, (_, j) => this.snapshot(read(slice * columns * rowCount + i * columns + j), 0, depth + 1)));
      return { $ref: ref, type: ArrayBuffer.isView(value) ? value.constructor.name : shape.length === 1 ? 'Vector' : shape.length === 2 ? 'Matrix' : 'Tensor', shape, rows, slices, slice };
    }
    const properties: Record<string, Signal> = Object.create(null);
    if (typeof value === 'object') for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)).slice(0, 12)) if ('value' in descriptor && !['__proto__', 'constructor', 'prototype'].includes(key)) properties[key] = this.snapshot(descriptor.value, 0, depth + 1);
    return { $ref: ref, type: typeof value === 'function' ? 'Function' : Object.getPrototypeOf(value)?.constructor?.name ?? 'Object', properties };
  }
  async execute(plan: ProjectPlan, external: Record<string, ExternalValue> = {}, mode: 'live' | 'step' = 'live'): Promise<ExecutionResult> {
    const started = performance.now(); if (mode === 'step') this.tick++;
    const byId = new Map(plan.nodes.map(n => [n.id, n])), active = new Set<string>(), completed = new Map<string, Cell>();
    const results: Record<string, NodeResult> = Object.create(null), rawInputs = new Map<string, Record<string, unknown>>();
    const visit = async (id: string): Promise<Cell> => {
      if (active.has(id)) throw new Error('Cycle detected. Use explicit state and trigger sequencing.');
      const done = completed.get(id); if (done) return done;
      const node = byId.get(id); if (!node) throw new Error('Missing upstream block.');
      active.add(id); let began = performance.now(); const inputs: Record<string, unknown> = Object.create(null), inputEvents: Record<string, number> = {};
      let cell: Cell, cached = false;
      try {
        for (const p of node.data.ports.filter(p => p.type === 'input')) {
          const link = node.inputs[p.id];
          if (link) { const source = await visit(link.node); if (source.status === 'error' || source.status === 'blocked') throw new Error('Upstream block failed.'); if (!Object.hasOwn(source.outputs, link.port)) throw new Error('Upstream block has not executed.'); inputs[p.id] = source.outputs[link.port]; inputEvents[p.id] = source.events[link.port] ?? 0; }
        }
        const aliasOutputs: Record<string, unknown> = {}, aliasEvents: Record<string, number> = {};
        for (const [port, link] of Object.entries(node.aliases)) { const source = await visit(link.node); if (source.status === 'error' || source.status === 'blocked') throw new Error('Upstream block failed.'); if (!Object.hasOwn(source.outputs, link.port)) throw new Error('Upstream block has not executed.'); aliasOutputs[port] = source.outputs[link.port]; aliasEvents[port] = source.events[link.port] ?? 0; }
        began = performance.now();
        const operation = node.data.operation;
        const signature = JSON.stringify([node.data.value, Object.entries(inputs).map(([k, v]) => [k, this.identity(v), inputEvents[k]]), Object.entries(aliasOutputs).map(([k, v]) => [k, this.identity(v)]), external[id]?.values, external[id]?.events, node.data.recipe === 'Clock' ? Math.floor((Date.now() - this.clockStart) / Math.max(16, Number(node.data.value) || 1000)) : null]);
        const previous = this.cache.get(id);
        const hasTrigger = !!node.inputs.trigger;
        const initialEvent = (inputEvents.trigger ?? 0) > 0 || ![undefined, null, false, 0].includes(inputs.trigger as never);
        const triggerChanged = hasTrigger && (previous ? (inputEvents.trigger ?? 0) !== (previous.events.$trigger ?? 0) || !Object.is(inputs.trigger, previous.outputs.$trigger) : initialEvent);
        const effectAllowed = !operation || operation.effect === 'pure' || hasTrigger && triggerChanged || !hasTrigger && operation.effect === 'step' && mode === 'step';
        const alwaysStep = mode === 'step' && !!operation && operation.type !== 'construct' && operation?.type !== 'export';
        const same = previous?.signature === signature;
        if (previous?.status === 'ok' && same && !alwaysStep && !triggerChanged || previous && !effectAllowed) { cell = previous; cached = true; }
        else if (!effectAllowed) cell = { outputs: { $trigger: inputs.trigger }, signature, events: { $trigger: inputEvents.trigger ?? 0 }, status: 'idle' };
        else {
          const outputs = await this.evaluate(node, inputs, aliasOutputs, external[id], previous, same, mode);
          const events: Record<string, number> = { ...aliasEvents, ...(external[id]?.events ?? {}) };
          for (const key of Object.keys(outputs)) if (!(key in events)) events[key] = key === 'done' ? (previous?.events.done ?? 0) + 1 : previous?.events[key] ?? 0;
          events.$trigger = inputEvents.trigger ?? 0;
          // Private trigger comparison data stays in the runtime and is never sent to views.
          outputs.$trigger = inputs.trigger;
          cell = { outputs, signature, events, status: 'ok' };
        }
      } catch (error) { cell = { outputs: {}, signature: '', events: {}, status: errorText(error).startsWith('Upstream block') ? 'blocked' : 'error', error: errorText(error) }; }
      active.delete(id); rawInputs.set(id, inputs); completed.set(id, cell); this.cache.set(id, cell);
      const slice = node.data.renderer?.slice ?? 0;
      results[id] = { inputs: {}, outputs: {}, status: cell.status, ...(cell.error ? { error: cell.error } : {}), ms: performance.now() - began, cached };
      return cell;
    };
    for (const id of [...byId.keys()].sort()) await visit(id);
    for (const [id, cell] of completed) { const slice = byId.get(id)?.data.renderer?.slice ?? 0; results[id].inputs = Object.fromEntries(Object.entries(rawInputs.get(id) ?? {}).map(([k, v]) => [k, this.snapshot(v, slice)])); results[id].outputs = Object.fromEntries(Object.entries(cell.outputs).filter(([k]) => k !== '$trigger').map(([k, v]) => [k, this.snapshot(v, slice)])); }
    return { nodes: results, tick: this.tick, ms: performance.now() - started, catalog: this.catalog };
  }
  private async evaluate(node: RuntimeNode, inputs: Record<string, unknown>, aliases: Record<string, unknown>, external: ExternalValue | undefined, previous: Cell | undefined, same: boolean | undefined, mode: 'live' | 'step'): Promise<Record<string, unknown>> {
    const { data } = node, ports = data.ports.filter(p => p.type === 'output');
    const publish = (value: unknown) => Object.fromEntries(ports.map(p => [p.id, value]));
    if (Object.keys(aliases).length) return aliases;
    if (data.operation) {
      const op = data.operation;
      const module = this.modules[nodeModuleAlias(node, this.catalog)];
      const parameters = data.value.trim() ? JSON.parse(data.value) : null;
      const defaults = Array.isArray(parameters) ? parameters : [];
      const args = data.ports.filter(p => p.type === 'input' && !['object', 'trigger'].includes(p.id)).map((p, i) => p.id in inputs ? inputs[p.id] : defaults[i]);
      let result: unknown;
      if (op.type === 'export') { if (!module || !Object.hasOwn(module, op.exportName!)) throw new Error('Module export is unavailable.'); result = module[op.exportName!]; }
      if (op.type === 'function' || op.type === 'construct') {
        const fn = module?.[op.exportName!]; if (typeof fn !== 'function') throw new Error('Choose a callable module export.');
        if (op.type === 'construct') { if (previous && !same) await this.release(previous.outputs.result); result = Reflect.construct(fn, args); }
        else result = await Reflect.apply(fn, undefined, args);
      }
      if (op.type === 'method' || op.type === 'property') {
        const object = inputs.object;
        if (!record(object) && typeof object !== 'function') throw new Error('Connect a live instance to the object input.');
        const member = safeMember(op.member!);
        if (op.type === 'property') result = Reflect.get(object as object, member);
        else { const fn = Reflect.get(object as object, member); if (typeof fn !== 'function') throw new Error(`Instance has no method '${member}'.`); result = await Reflect.apply(fn, object, args); if (op.effect !== 'pure') this.mutate(object); }
      }
      if (op.type === 'code') {
        const run = this.code.get(node.id)?.run; if (typeof run !== 'function') throw new Error('Export a run({ inputs, modules, state, parameters, tick }) function.');
        const named = { ...inputs }; for (const p of data.ports) if (p.type === 'input' && p.variable) named[p.variable] = inputs[p.id];
        const modules = op.uses?.length ? Object.fromEntries(op.uses.map(alias => { if (!this.modules[alias]) throw new Error(`Missing module alias '${alias}'.`); return [alias, this.modules[alias]]; })) : this.modules;
        let state = this.states.get(node.id); if (!state) { state = {}; this.states.set(node.id, state); }
        result = await Reflect.apply(run, undefined, [{ inputs: named, modules, state, parameters, tick: this.tick }]);
        if (op.effect !== 'pure') Object.values(inputs).forEach(value => this.mutate(value));
        const mapped: Record<string, unknown> = {};
        for (const p of ports) mapped[p.id] = p.id === 'done' ? this.tick : record(result) && Object.hasOwn(result, p.variable ?? p.id) ? result[p.variable ?? p.id] : result;
        return mapped;
      }
      return Object.fromEntries(ports.map(p => [p.id, p.id === 'instance' ? inputs.object : p.id === 'done' ? (previous?.events.done ?? 0) + 1 : result]));
    }
    if (data.kind === 'javascript') {
      if (!data.nativeRecipe) return { ...(external?.values ?? {}) };
      if (['Number', 'Boolean', 'Vector', 'Matrix', 'Tensor'].includes(data.recipe ?? '')) return publish(JSON.parse(data.value));
      if (data.recipe === 'String') return publish(data.value);
      if (data.recipe === 'Slider') { const config = JSON.parse(data.value); return publish(config.initial); }
      if (data.recipe === 'Selector') { const config = JSON.parse(data.value); return publish(config.options[config.selected ?? 0]); }
      if (data.recipe === 'Button') return publish(JSON.parse(data.value).count ?? 0);
      if (data.recipe === 'Clock') return publish(Math.floor((Date.now() - this.clockStart) / Math.max(16, Number(data.value) || 1000)));
      if (data.recipe === 'Trigger') {
        const active = Boolean(Object.values(inputs)[0]); let state = this.states.get(node.id); if (!state) { state = { active: false, count: 0 }; this.states.set(node.id, state); }
        if (active && !state.active) state.count = Number(state.count) + 1; state.active = active; return publish(state.count);
      }
      return { ...(external?.values ?? {}) };
    }
    const values = data.ports.filter(p => p.type === 'input').map(p => inputs[p.id]), first = values[0];
    if (data.kind === 'constant') { try { return publish(JSON.parse(data.value)); } catch { return publish(data.value); } }
    if (data.kind === 'gain') return publish(typeof first === 'number' ? first * Number(data.value) : null);
    if (data.kind === 'sum') return publish(values.every(v => typeof v === 'number') ? values.reduce<number>((sum, v, i) => sum + Number(v) * (data.value[i] === '-' ? -1 : 1), 0) : null);
    if (data.kind === 'outport' || data.kind === 'inport') return publish(first ?? null);
    return publish(null);
  }
  async dispose() {
    for (const cell of this.cache.values()) for (const value of Object.values(cell.outputs)) try { await this.release(value); } catch { /* One disposer must not prevent the rest. */ }
    this.cache.clear(); this.states.clear(); this.code.clear();
  }
}
function nodeModuleAlias(node: RuntimeNode, catalog: ModuleInfo[]) { return catalog.find(m => m.id === node.data.operation?.moduleId)?.alias ?? ''; }
