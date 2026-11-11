import { describe, expect, it, vi } from 'vitest';
import { makeNode, exampleDiagram, parseDiagram, serializeDiagram, type BlockNode, type Diagram } from '../model';
import { sharedModulesExample } from './example';
import { ModuleLoader } from './loader';
import { ProjectEngine, inspectExports } from './engine';
import { compileProject, definitionKey, executionKey, nodeKey } from './graph';
import { makeOperationBlock, operationPorts } from './blocks';
import { exampleModuleSource, parseModules, type ProjectModule } from './schema';
const definition: ProjectModule = { id: 'math', alias: 'math', source: exampleModuleSource };
let moduleIndex = 0;
function loader(modules: ProjectModule[]) { return new ModuleLoader(modules, { createURL: source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleIndex++}` }); }
function diagram(nodes: BlockNode[], edges: Diagram['edges'] = [], modules = [definition]): Diagram { return { ...exampleDiagram(), nodes, edges, modules }; }
function wire(source: string, target: string, targetHandle = 'arg-0', sourceHandle = 'result') { return { id: `${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle, type: 'smoothstep' }; }
async function prepare(project: Diagram) {
  const plan = compileProject(project), l = loader(plan.modules), modules = await l.load(), engine = new ProjectEngine(modules, plan.modules, 'test');
  for (const node of plan.nodes) if (node.data.operation?.type === 'code') engine.setCode(node.id, await l.code(node.data.module!));
  return { engine, plan, modules };
}
function output(result: Awaited<ReturnType<ProjectEngine['execute']>>, id: string, port = 'result') { return result.nodes[nodeKey([], id)].outputs[port]; }
function op(name: string, type: 'function' | 'class' | 'value', args: string[] = []) { const node = makeOperationBlock(definition, { name, kind: type, args, methods: [] }, { x: 0, y: 0 }); node.id = name; return node; }
function method(id: string, member: string, args: string[] = []) { const node = makeOperationBlock(definition, undefined, { x: 0, y: 0 }, { name: member, args }); node.id = id; return node; }

describe('project module loading and export discovery', () => {
  it('shares a single namespace, class and primitive across imports and code consumers', async () => {
    const defs = [definition, { id: 'consumer', alias: 'consumer', source: "import { Accumulator, EPSILON } from 'math'; export { Accumulator }; export const epsilon=EPSILON;" }];
    const l = loader(defs), modules = await l.load();
    expect(modules.consumer.Accumulator).toBe(modules.math.Accumulator); expect(modules.consumer.epsilon).toBe(modules.math.EPSILON);
    const code = await l.code("import { add } from 'math'; export function run(){return add(2,3)}");
    expect((code.run as Function)()).toBe(5);
    expect(await l.resolve('math')).toBe(await l.resolve('math'));
  });
  it('preserves class identity for relative imports between uploaded files', async () => {
    const modules = await loader([{ ...definition, filename: 'math.js' }, { id: 'consumer', alias: 'consumer', filename: 'consumer.js', source: "import { Accumulator } from './math.js'; export { Accumulator };" }]).load();
    expect(modules.consumer.Accumulator).toBe(modules.math.Accumulator);
  });
  it('discovers constructors, methods, defaulted argument manifests, and constants', async () => {
    const modules = await loader([definition]).load(); const entries = inspectExports(modules.math);
    expect(entries.find(e => e.name === 'Accumulator')).toMatchObject({ kind: 'class', args: ['initial'], methods: [{ name: 'add', args: ['amount'] }, { name: 'read', args: [] }, { name: 'reset', args: [] }] });
    expect(entries.find(e => e.name === 'EPSILON')?.kind).toBe('value');
    expect(entries.find(e => e.name === 'matmul')?.args).toEqual(['a', 'b']);
  });
  it('recognizes anonymous classes and manifest-declared legacy constructors', async () => {
    const modules = await loader([{ id: 'types', alias: 'types', source: "export default class{}; export function Legacy(value){this.value=value;} export const milver={Legacy:{kind:'class',args:['value']}};" }]).load();
    expect(inspectExports(modules.types).find(e => e.name === 'default')?.kind).toBe('class');
    expect(inspectExports(modules.types).find(e => e.name === 'Legacy')).toMatchObject({ kind: 'class', args: ['value'] });
  });
  it('resolves local helpers and literal dynamic imports without rewriting text/comments', async () => {
    const l = loader([{ id: 'm', alias: 'm', source: "// import 'imaginary'\nexport const text=\"import('nope')\"; export async function value(){ return (await import('helper')).answer; }", dependencies: [{ specifier: 'helper', source: 'export const answer=42;' }] }]);
    const modules = await l.load(); expect(await (modules.m.value as Function)()).toBe(42); expect(modules.m.text).toBe("import('nope')");
  });
  it('reports unknown, cyclic and conflicting dependencies', async () => {
    await expect(loader([{ id: 'm', alias: 'm', source: "import 'missing';" }]).load()).rejects.toThrow('Unknown module');
    await expect(loader([{ id: 'a', alias: 'a', source: "import 'b'" }, { id: 'b', alias: 'b', source: "import 'a'" }]).load()).rejects.toThrow('Circular');
    expect(() => loader([{ ...definition, dependencies: [{ specifier: 'helper', source: 'export const x=1' }] }, { id: 'b', alias: 'b', source: '', dependencies: [{ specifier: 'helper', source: 'export const x=2' }] }])).toThrow('Conflicting');
  });
  it('shares a remote module between its project alias and direct URL imports', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('export class Box {}'));
    try {
      const modules = await loader([{ id: 'remote', alias: 'remote', url: 'https://example.com/box.js' }, { id: 'consumer', alias: 'consumer', source: "import {Box} from 'https://example.com/box.js'; export {Box};" }]).load();
      expect(modules.consumer.Box).toBe(modules.remote.Box); expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { fetcher.mockRestore(); }
  });
  it('resolves relative remote imports with credentials omitted', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(String(url).endsWith('index.js') ? "export { value } from './value.js';" : 'export const value=19;'));
    try { const modules = await loader([{ id: 'remote', alias: 'remote', url: 'https://example.com/index.js' }]).load(); expect(modules.remote.value).toBe(19); expect(fetcher).toHaveBeenCalledWith('https://example.com/value.js', { credentials: 'omit' }); } finally { fetcher.mockRestore(); }
  });
});

describe('shared graph execution', () => {
  it('runs functions and constants and retains large tensor values inside the runtime', async () => {
    const call = op('matmul', 'function', ['a', 'b']); call.data.value = '[[[1,2],[3,4]],[[5],[6]]]';
    const constant = op('EPSILON', 'value');
    const { engine, plan } = await prepare(diagram([call, constant])); const result = await engine.execute(plan);
    expect(output(result, 'matmul')).toMatchObject({ type: 'Matrix', shape: [2, 1], rows: [[17], [39]] });
    expect(output(result, 'EPSILON')).toBe(1e-6);
    const snapshot = engine.snapshot(new Float32Array(1000000)); expect(snapshot).toMatchObject({ type: 'Float32Array', shape: [1000000] }); expect(JSON.stringify(snapshot).length).toBeLessThan(1000);
  });
  it('passes the same instance through methods, orders done→trigger and preserves it across steps', async () => {
    const instance = op('Accumulator', 'class', ['initial']); instance.data.value = '[10]';
    const first = method('z-first', 'add', ['amount']); first.data.value = '[2]';
    const second = method('a-second', 'add', ['amount']); second.data.value = '[3]';
    const project = diagram([instance, first, second], [wire(instance.id, first.id, 'object'), wire(first.id, second.id, 'object', 'instance'), wire(first.id, second.id, 'trigger', 'done')]);
    const { engine, plan } = await prepare(project);
    const live = await engine.execute(plan); expect(live.nodes[nodeKey([], first.id)].status).toBe('idle');
    const result = await engine.execute(plan, {}, 'step'); expect(output(result, first.id)).toBe(12); expect(output(result, second.id)).toBe(15);
    const instanceRef = (output(result, instance.id) as Record<string, unknown>).$ref;
    expect((output(result, first.id, 'instance') as Record<string, unknown>).$ref).toBe((output(result, second.id, 'instance') as Record<string, unknown>).$ref);
    const secondRun = await engine.execute(plan, {}, 'step'); expect(output(secondRun, second.id)).toBe(20);
    expect((output(secondRun, instance.id) as Record<string, unknown>).$ref).toBe(instanceRef);
  });
  it('allows step-only constructors to initialize once after an idle live preview', async () => {
    const instance = op('Accumulator', 'class'); instance.data.operation!.effect = 'step';
    const { engine, plan } = await prepare(diagram([instance])); expect((await engine.execute(plan)).nodes[nodeKey([], instance.id)].status).toBe('idle');
    const first = output(await engine.execute(plan, {}, 'step'), instance.id) as Record<string, unknown>;
    expect(first.type).toBe('Accumulator'); expect((output(await engine.execute(plan, {}, 'step'), instance.id) as Record<string, unknown>).$ref).toBe(first.$ref);
  });
  it('does not treat an initial zero trigger value as an event', async () => {
    const instance = op('Accumulator', 'class'), add = method('method', 'add', ['amount']); add.data.value = '[2]';
    const trigger = makeNode('constant', { x: 0, y: 0 }, 'zero'); trigger.data.value = '0';
    const project = diagram([instance, add, trigger], [wire(instance.id, add.id, 'object'), wire(trigger.id, add.id, 'trigger', 'out-0')]);
    const { engine, plan } = await prepare(project);
    expect((await engine.execute(plan)).nodes[nodeKey([], add.id)].status).toBe('idle');
    expect((await engine.execute(plan)).nodes[nodeKey([], add.id)].status).toBe('idle');
    trigger.data.value = '1'; expect(output(await engine.execute(compileProject(project)), add.id)).toBe(2);
  });
  it('does not repeat mutations for live refresh, layout edits, or repeated unchanged events', async () => {
    const instance = op('Accumulator', 'class'), add = method('add', 'add', ['amount']); add.data.value = '[2]';
    const button = makeNode('constant', { x: 0, y: 0 }, 'trigger'); button.data.value = '1';
    const project = diagram([instance, add, button], [wire(instance.id, add.id, 'object'), wire('trigger', add.id, 'trigger', 'out-0')]);
    const { engine, plan } = await prepare(project);
    expect(output(await engine.execute(plan), add.id)).toBe(2);
    expect(output(await engine.execute(plan), add.id)).toBe(2);
    expect(output(await engine.execute(plan, {}, 'step'), add.id)).toBe(2);
    button.data.value = '2'; expect(output(await engine.execute(compileProject(project)), add.id)).toBe(4);
    const before = definitionKey(plan), run = executionKey(plan); project.nodes[0].position.x += 99; project.name = 'renamed'; project.nodes[0].data.label = 'renamed';
    expect(definitionKey(compileProject(project))).toBe(before);
    // The trigger parameter changed; changing layout alone never changes either key.
    expect(executionKey(compileProject(project))).not.toBe(run);
  });
  it('shares modules and object identity across nested inports/outports', async () => {
    const instance = op('Accumulator', 'class', ['initial']); instance.data.value = '[8]';
    const parent = makeNode('subsystem', { x: 0, y: 0 }, 'parent');
    const input = parent.data.canvas!.nodes.find(n => n.data.kind === 'inport')!, out = parent.data.canvas!.nodes.find(n => n.data.kind === 'outport')!;
    const call = method('method', 'add', ['amount']); call.data.value = '[4]';
    parent.data.canvas!.nodes = [input, out, call]; parent.data.canvas!.edges = [wire(input.id, call.id, 'object', 'out-0'), wire(call.id, out.id, 'in-0')];
    const display = makeNode('renderer', { x: 0, y: 0 }, 'display');
    const project = diagram([instance, parent, display], [wire(instance.id, parent.id, input.id), wire(parent.id, display.id, 'in-0', out.id)]);
    const { engine, plan } = await prepare(project); const result = await engine.execute(plan, {}, 'step');
    expect(result.nodes[nodeKey(['parent'], call.id)].outputs.result).toBe(12); expect(result.nodes[nodeKey([], 'display')].inputs['in-0']).toBe(12);
  });
  it('runs async code, named inputs, declared aliases, and retained state without blocking graph order', async () => {
    const code = makeNode('compute', { x: 0, y: 0 }, 'code'); code.data.operation = { type: 'code', effect: 'step', uses: ['math'] }; code.data.value = '3';
    code.data.module = 'export async function run({modules,state,parameters}) { state.count=(state.count??0)+1; await Promise.resolve();return {result:modules.math.add(parameters,state.count)}; }';
    const { engine, plan } = await prepare(diagram([code])); expect(output(await engine.execute(plan, {}, 'step'), 'code')).toBe(4); expect(output(await engine.execute(plan, {}, 'step'), 'code')).toBe(5);
  });
  it('delivers equal-payload events separately without repeating an unchanged event', async () => {
    const instance = op('Accumulator', 'class'), add = method('method', 'add', ['amount']); add.data.value = '[1]';
    const event = makeNode('javascript', { x: 0, y: 0 }, 'events');
    const { engine, plan } = await prepare(diagram([instance, add, event], [wire(instance.id, add.id, 'object'), wire('events', add.id, 'trigger', 'out-0')]));
    const external = { [nodeKey([], 'events')]: { values: { 'out-0': true }, events: { 'out-0': 1 } } };
    expect(output(await engine.execute(plan, external), add.id)).toBe(1);
    expect(output(await engine.execute(plan, external), add.id)).toBe(1);
    external[nodeKey([], 'events')].events['out-0']++;
    expect(output(await engine.execute(plan, external), add.id)).toBe(2);
  });
  it('supports a trainable user-defined module without model logic in the framework', async () => {
    const learning: ProjectModule = { id: 'learning', alias: 'learning', source: `export class Linear { constructor(){this.weight=0;} step(xs,ys,rate){const grad=xs.reduce((s,x,i)=>s+2*x*(x*this.weight-ys[i]),0)/xs.length;this.weight-=rate*grad;return xs.reduce((s,x,i)=>s+(x*this.weight-ys[i])**2,0)/xs.length;} }` };
    const instance = makeOperationBlock(learning, { name: 'Linear', kind: 'class', args: [], methods: [] }, { x: 0, y: 0 }); instance.id = 'model';
    const train = makeOperationBlock(learning, undefined, { x: 0, y: 0 }, { name: 'step', args: ['xs', 'ys', 'rate'] }); train.id = 'train'; train.data.value = '[[1,2,3],[2,4,6],0.02]';
    const { engine, plan } = await prepare(diagram([instance, train], [wire('model', 'train', 'object')], [learning]));
    const first = output(await engine.execute(plan, {}, 'step'), 'train') as number;
    let loss = first; for (let i = 0; i < 30; i++) loss = output(await engine.execute(plan, {}, 'step'), 'train') as number;
    expect(loss).toBeLessThan(first / 100); expect(output(await engine.execute(plan), 'train')).toBe(loss);
  });
  it('honors edits to legacy source recipe code instead of replacing it with native behavior', async () => {
    const { makeJsNode } = await import('../js-recipes');
    const number = makeJsNode('Number', { x: 0, y: 0 }, 'number'); number.data.module = 'export default function mount({emit}){emit(99)}';
    const { engine, plan } = await prepare(diagram([number]));
    expect(plan.nodes[0].data.nativeRecipe).toBe(false);
    expect(output(await engine.execute(plan, { [nodeKey([], 'number')]: { values: { 'out-0': 99 } } }), 'number', 'out-0')).toBe(99);
  });
  it('does not invoke getters while generating bounded object previews', () => {
    const getter = vi.fn(() => { throw new Error('must not be read'); });
    const value = Object.defineProperty({ value: 3 }, 'shape', { get: getter });
    const engine = new ProjectEngine({}, []); expect(engine.snapshot(value)).toMatchObject({ properties: { value: 3 } }); expect(getter).not.toHaveBeenCalled();
  });
  it('reports cycles and failed upstream calls and recovers after parameter fixes', async () => {
    const a = op('add', 'function', ['a', 'b']); a.id = 'a'; const b = op('add', 'function', ['a', 'b']); b.id = 'b';
    const cyclic = await prepare(diagram([a, b], [wire('a', 'b'), wire('b', 'a')])); const result = await cyclic.engine.execute(cyclic.plan); expect(Object.values(result.nodes).some(n => n.error?.includes('Cycle'))).toBe(true);
    const bad = op('matmul', 'function', ['a', 'b']); bad.data.value = '[[[1,2]],[[1]]]'; const runtime = await prepare(diagram([bad])); expect((await runtime.engine.execute(runtime.plan)).nodes[nodeKey([], bad.id)].status).toBe('error');
    bad.data.value = '[[[1,2]],[[1],[2]]]'; expect(output(await runtime.engine.execute(compileProject(diagram([bad]))), bad.id)).toMatchObject({ rows: [[5]] });
  });
  it('reuses pure computations and disposes instances once on reset', async () => {
    const dispose = vi.fn(); const call = vi.fn((a: number) => a * 2); class Box { dispose = dispose; }
    const a = op('double', 'function', ['a']); a.data.value = '[3]'; const b = op('Box', 'class');
    const plan = compileProject(diagram([a, b])); const engine = new ProjectEngine({ math: { double: call, Box } }, [definition]);
    expect(output(await engine.execute(plan), 'double')).toBe(6); await engine.execute(plan); expect(call).toHaveBeenCalledTimes(1);
    await engine.dispose(); await engine.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('project persistence contract', () => {
  it('executes and round trips the bundled nested shared-instance example', async () => {
    const project = sharedModulesExample(); expect(parseDiagram(serializeDiagram(project))).toEqual(project);
    const { engine, plan } = await prepare(project); const live = await engine.execute(plan);
    expect(live.nodes[nodeKey([], 'matrix-view')].inputs['in-0']).toMatchObject({ rows: [[17], [39]] });
    expect(output(live, 'shared-code')).toBe(42);
    const step = await engine.execute(plan, {}, 'step'); expect(step.nodes[nodeKey([], 'instance-view')].inputs['in-0']).toBe(15);
    expect((await engine.execute(plan, {}, 'step')).nodes[nodeKey([], 'instance-view')].inputs['in-0']).toBe(20);
  });
  it('round trips project imports, configurable operations, nested instances, code and wiring', () => {
    const instance = op('Accumulator', 'class', ['initial']), add = method('method', 'add', ['amount']), imported = makeNode('module', { x: 0, y: 0 }, 'module'); imported.data.projectModuleId = definition.id;
    const d = diagram([instance, add, imported], [wire(instance.id, add.id, 'object')]);
    expect(parseDiagram(serializeDiagram(d))).toEqual(d);
    expect(serializeDiagram(d)).not.toContain('$ref'); expect(operationPorts('method', ['amount']).map(p => p.id)).toEqual(['object', 'arg-0', 'trigger', 'result', 'instance', 'done']);
  });
  it('rejects malformed imports, duplicate aliases and invalid operations while accepting legacy projects', () => {
    expect(() => parseModules([definition, { ...definition, id: 'other' }])).toThrow('unique');
    const project = diagram([makeNode('compute', { x: 0, y: 0 })]); project.nodes[0].data.operation!.effect = 'bad' as never;
    expect(() => parseDiagram(serializeDiagram(project))).toThrow('operation');
    const legacy = exampleDiagram(); delete legacy.modules;
    expect(parseDiagram(serializeDiagram(legacy)).modules).toBeUndefined();
  });
});
