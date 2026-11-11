import { buildBlockModule } from './block-code';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram, updateCanvas } from './model';
import { exampleWasm, jsRecipes, makeJsNode } from './js-recipes';
import { isSignal, previewSignals, signalsEqual, type Signal } from './runtime';
import { describeValue, formatValue } from './value-renderer';
import { moduleDocument } from './components/module-mask';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, isValidElement } from 'react';
import katex from 'katex';
import { TooltipProvider } from './components/ui/tooltip';
import { Inspector } from './components/inspector';
import { portAtBorder } from './ports';

class Element {
  textContent = ''; style: { cssText?: string } = {}; type = ''; min = ''; max = ''; step = ''; value = ''; selectedIndex = 0;
  children: Element[] = []; tagName = '';
  querySelector(tag: string): Element | undefined { return this.children.find(child => child.tagName === tag) ?? this.children.map(child => child.querySelector(tag)).find(Boolean); } oninput?: () => void; onchange?: () => void; onclick?: () => void;
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren(...children: Element[]) { this.children = children; }
  setAttribute() {}
}
async function mountRecipe(name: string, inputs: Record<string, Signal> = {}) {
  const node = makeJsNode(name, { x: 0, y: 0 }, name);
  const module = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(node.data.render !== undefined ? buildBlockModule(node.data.module!, node.data.render) : node.data.module!, 'utf8').toString('base64')}`);
  vi.stubGlobal('document', { createElement: (tag: string) => Object.assign(new Element(), { tagName: tag }) });
  const rendered: { current?: any } = {};
  const ui = { React: { createElement, isValidElement }, Button: 'button', Slider: 'input', Select: 'select', SelectTrigger: 'button', SelectValue: 'span', SelectContent: 'div', SelectItem: 'option', latex: (element: any, tex: string) => { element.innerHTML = katex.renderToString(tex, { output: 'mathml', throwOnError: true }); }, createRoot: () => ({ render: (node: any) => { rendered.current = node; }, unmount() {} }) };
  const element = new Element(), outputs: Signal[] = [], persisted: string[] = [];
  const mapped = (input: Record<string, Signal>) => ({ ...input, ...Object.fromEntries(node.data.ports.filter(p => p.type === 'input' && p.variable).map(p => [p.variable!, input[p.id] ?? null])) });
  let mounted: any;
  const edits: Promise<unknown>[] = [];
  mounted = await module.default({ element, ui, inputs: mapped(inputs), state: {}, modules: {}, value: node.data.value, emit: (v: Signal) => outputs.push(v), setValue: (v: string) => { persisted.push(v); edits.push(mounted.update(mapped(inputs), v)); }, wasm: node.data.wasm, ports: node.data.ports });
  const current = { update: (inputs: Record<string, Signal>, value = node.data.value) => mounted.update(mapped(inputs), value), destroy: () => mounted.destroy() };
  return { node, element, rendered, outputs, persisted, current, settle: () => Promise.all(edits) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('JavaScript recipe execution', () => {
  for (const [name, expected] of Object.entries({ Number: 1, Boolean: true, String: 'Hello', Vector: [1, 2, 3], Matrix: [[1, 2], [3, 4]], Tensor: { shape: [2, 2, 2], data: [1, 2, 3, 4, 5, 6, 7, 8] } })) {
    it(`executes the ${name} source and updates it`, async () => {
      const { outputs, current, node } = await mountRecipe(name);
      expect(outputs.at(-1)).toEqual(expected);
      await current.update({}, node.data.value);
      expect(outputs.at(-1)).toEqual(expected);
    });
  }
  it('validates datatype shape errors instead of emitting malformed data', async () => {
    const { current } = await mountRecipe('Matrix');
    await expect(current.update({}, '[[1],[2,3]]')).rejects.toThrow('rectangular');
    const { current: tensor } = await mountRecipe('Tensor');
    await expect(tensor.update({}, '{"shape":[2,3],"data":[1]}')).rejects.toThrow('matching');
  });
  it('emits clock ticks, changes its period and disposes the timer', async () => {
    vi.useFakeTimers(); const { current, outputs } = await mountRecipe('Clock');
    vi.advanceTimersByTime(3000); expect(outputs).toEqual([0, 1, 2, 3]);
    await current.update({}, '2000'); vi.advanceTimersByTime(2000); expect(outputs.at(-1)).toBe(4);
    await current.destroy(); vi.advanceTimersByTime(10000); expect(outputs.at(-1)).toBe(4);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('counts only rising edges', async () => {
    const { current, outputs } = await mountRecipe('Trigger', { 'in-0': false });
    for (const v of [true, true, false, false, true]) await current.update({ 'in-0': v });
    expect(outputs).toEqual([0, 1, 1, 1, 1, 2]);
  });
  it('saves and emits slider edits and restores edited configuration', async () => {
    const { element, rendered, outputs, persisted, current, settle } = await mountRecipe('Slider');
    const control = rendered.current.props.children[0]; control.props.onValueChange([75]); await settle();
    expect(outputs.at(-1)).toBe(75); expect(JSON.parse(persisted[0]).initial).toBe(75);
    await current.update({}, persisted[0]); expect(rendered.current.props.children[0].props.value).toEqual([75]);
  });
  it('saves selector choices and button click counts', async () => {
    const selector = await mountRecipe('Selector'); const select = selector.rendered.current;
    select.props.onValueChange('2'); await selector.settle(); expect(selector.outputs.at(-1)).toBe('C'); expect(JSON.parse(selector.persisted[0]).selected).toBe(2);
    const button = await mountRecipe('Button'); button.rendered.current.props.onClick(); await button.settle(); button.rendered.current.props.onClick(); await button.settle();
    expect(button.outputs).toEqual([0, 1, 2]); expect(JSON.parse(button.persisted.at(-1)!).count).toBe(2);
  });
  it('instantiates the embedded Wasm binary and maps numeric inputs', async () => {
    const { outputs, current } = await mountRecipe('WebAssembly', { 'in-0': 6, 'in-1': 7 });
    expect(outputs.at(-1)).toBe(13);
    await current.update({ 'in-0': 10, 'in-1': 20 }); expect(outputs.at(-1)).toBe(30);
    await current.update({ 'in-0': null, 'in-1': 20 }); expect(outputs.at(-1)).toBeNull();
    expect(WebAssembly.validate(Uint8Array.from(atob(exampleWasm), c => c.charCodeAt(0)))).toBe(true);
  });
});

describe('JSON ↔ UI code contract', () => {
  it('round trips every recipe, module import, mapping, Wasm binary and renderer setting', () => {
    const d = exampleDiagram(); d.edges = [];
    d.nodes = Object.keys(jsRecipes).map((name, i) => makeJsNode(name, { x: i * 300, y: 0 }, `js-${i}`));
    d.nodes[0].data.dependencies = [{ specifier: 'helper', source: 'export const answer = 42;' }, { specifier: 'external', url: 'https://example.com/module.js' }];
    const renderer = makeNode('renderer', { x: 0, y: 300 }, 'renderer'); renderer.data.renderer = { precision: 7, slice: 3 }; d.nodes.push(renderer);
    const restored = parseDiagram(serializeDiagram(d)); expect(restored).toEqual(d);
    const second = parseDiagram(serializeDiagram(restored)); expect(second).toEqual(d);
  });
  it('keeps code and bindings when editing nested blocks and recreates their UI', () => {
    const d = exampleDiagram(), parent = makeNode('subsystem', { x: 0, y: 0 }, 'parent'); d.nodes.push(parent);
    const child = makeJsNode('WebAssembly', { x: 100, y: 300 }, 'wasm');
    const next = updateCanvas(d, ['parent'], c => ({ ...c, nodes: [...c.nodes, child] }));
    const restored = parseDiagram(serializeDiagram(next)); const node = restored.nodes.at(-1)!.data.canvas!.nodes.at(-1)!;
    const markup = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(Inspector, { node, nodes: [node], activePort: null, setActivePort() {}, update() {}, resize() {}, updatePort() {}, removePort() {}, addPort() {}, enter() {}, duplicate() {}, remove() {}, updateEdge() {} })));
    expect(markup).toContain('Properties'); expect(markup).toContain('tab-code'); expect(markup).toContain('JavaScript source'); expect(markup).toContain('value="input1"'); expect(markup).toContain('add.wasm');
    expect(node.data).toEqual(child.data);
  });
  it('rejects duplicate and invalid mappings, dependency URLs and malformed Wasm/configuration', () => {
    const test = (change: (data: any) => void, message: string) => { const d = exampleDiagram(); d.nodes = [makeJsNode('WebAssembly', { x: 0, y: 0 }, 'wasm')]; d.edges = []; change(d.nodes[0].data); expect(() => parseDiagram(serializeDiagram(d))).toThrow(message); };
    test(data => { data.ports[1].variable = data.ports[0].variable; }, 'Duplicate input');
    test(data => { data.ports[0].variable = 'not a variable'; }, 'port variable');
    test(data => { data.ports[1].id = 'input1'; }, 'conflicts');
    test(data => { data.dependencies = [{ specifier: 'helper', url: 'javascript:alert(1)' }]; }, 'module URL');
    test(data => { data.dependencies = [{ specifier: 'helper', source: 'export{}', url: 'https://example.com/' }]; }, 'either');
    test(data => { data.wasm.base64 = 'bad'; }, 'WebAssembly');
    test(data => { data.renderer = { precision: 99, slice: -1 }; }, 'renderer');
  });
  it('keeps sandbox source escaped, resolves dependencies before imports and includes alias mappings', () => {
    const node = makeJsNode('Number', { x: 0, y: 0 });
    const document = moduleDocument("import { answer } from 'helper'; export default () => { /* </script> */ }", { ports: node.data.ports, dependencies: [{ specifier: 'helper', source: 'export const answer=42;' }], token: 'nonce' });
    expect(document.match(/<\/script>/g)).toHaveLength(1);
    expect(document).toContain('map.type=\'importmap\''); expect(document).toContain('p.variable===port'); expect(document).toContain('variables[p.variable]'); expect(document).toContain('token:config.token');
  });
});

describe('structured signal rendering and propagation', () => {
  it('accepts bounded arrays and tensors and rejects cyclic, nonfinite and oversized messages', () => {
    expect(isSignal({ shape: [2, 2], data: [1, 2, 3, 4] })).toBe(true);
    expect(isSignal([NaN])).toBe(false); expect(isSignal(Infinity)).toBe(false); expect(isSignal(new Array(13000).fill(1))).toBe(false);
    const cycle: any = []; cycle.push(cycle); expect(isSignal(cycle)).toBe(false);
    expect(isSignal(JSON.parse('{"__proto__":42}'))).toBe(false);
    expect(signalsEqual([[1, 2]], [[1, 2]])).toBe(true);
  });
  it('propagates structured module outputs to a renderer without serializing live values', () => {
    const js = makeJsNode('Matrix', { x: 0, y: 0 }, 'matrix'), renderer = makeNode('renderer', { x: 300, y: 0 }, 'renderer');
    const d = { ...exampleDiagram(), nodes: [js, renderer], edges: [{ id: 'wire', source: 'matrix', sourceHandle: 'out-0', target: 'renderer', targetHandle: 'in-0' }] };
    const preview = previewSignals(d, { matrix: { 'out-0': [[1, 2], [3, 4]] } });
    expect(preview.renderer.inputs['in-0']).toEqual([[1, 2], [3, 4]]);
    expect(JSON.parse(serializeDiagram(d)).nodes[0].data).not.toHaveProperty('outputs');
  });
  it('renders scalar, vector, matrix, nested tensor and shaped tensor slices', () => {
    expect(describeValue(42).kind).toBe('Number'); expect(describeValue([1, 2]).shape).toEqual([2]);
    expect(describeValue([[1, 2], [3, 4]]).rows).toEqual([[1, 2], [3, 4]]);
    expect(describeValue([[[1, 2]], [[3, 4]]], 1).rows).toEqual([[3, 4]]);
    const tensor = describeValue({ shape: [2, 2, 2], data: [1, 2, 3, 4, 5, 6, 7, 8] }, 1);
    expect(tensor.slices).toBe(2); expect(tensor.rows).toEqual([[5, 6], [7, 8]]);
    expect(describeValue([[1], [2, 3]]).error).toContain('rectangular');
    expect(describeValue({ shape: [2, 3], data: [1] }).error).toContain('match');
    expect(formatValue(1.234567, 3)).toBe('1.235');
  });
  it('returns snap metadata only while aligned, without changing persisted port schema', () => {
    const ports = makeNode('sum', { x: 0, y: 0 }).data.ports;
    expect(portAtBorder(0, 34, 200, 100, ports, 'in-0').snapped).toBe(true);
    expect(portAtBorder(0, 43, 200, 100, ports, 'in-0').snapped).toBeUndefined();
  });
});

describe('editable logic, render and ownership JSON', () => {
  it('round trips nested render state, global libraries and property ownership', () => {
    const d = exampleDiagram();
    const block = makeJsNode('DOM', { x: 0, y: 0 }, 'split');
    block.data.state = { result: 42, settings: { enabled: true } };
    block.data.controlledProperties = ['label', 'width', 'visuals.background'];
    d.modules = [{ id: 'math', alias: 'math', source: 'export const double = x => x * 2;' }];
    d.nodes = [block]; d.edges = [];
    const restored = parseDiagram(serializeDiagram(d));
    expect(restored).toEqual(d);
    expect(restored.nodes[0].data.render).toContain('state.result');
    const markup = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(Inspector, { node: restored.nodes[0], nodes: restored.nodes, activePort: null, setActivePort() {}, update() {}, resize() {}, updatePort() {}, removePort() {}, addPort() {}, enter() {}, duplicate() {}, remove() {}, updateEdge() {} })));
    expect(markup).toMatch(/disabled=""[^>]*aria-label="Block name"/);
    expect(markup).toMatch(/disabled=""[^>]*aria-label="Block width"/);
    expect(markup).toMatch(/disabled=""[^>]*aria-label="Block fill"/);
    expect(markup).toContain('Render function source');
    expect(markup).toContain('Block JSON');
    const properties = markup.split('id="panel-properties"')[1].split('id="panel-render"')[0];
    expect(properties).not.toContain('Runtime');
    expect(properties).not.toContain('Inputs → outputs');
  });
  it('rejects invalid render source, state and ownership without losing the project', () => {
    for (const patch of [{ render: 42 }, { state: [1, 2] }, { state: JSON.parse('{"__proto__":42}') }, { controlledProperties: ['unknown'] }, { controlledProperties: ['label', 'label'] }]) {
      const d = exampleDiagram(); d.edges = []; d.nodes = [makeJsNode('DOM', { x: 0, y: 0 }, 'split')];
      Object.assign(d.nodes[0].data, patch);
      expect(() => parseDiagram(serializeDiagram(d))).toThrow();
    }
  });
});
