import { transform } from 'sucrase';
import type { BlockData } from './model';

export const defaultLogic = `async function run() {
  state.result = inputs.input1 ?? Number(value);
  emit(state.result);
  await render();
}`;
export const defaultRender = `async function render() {
  // state.result: the value computed in Code; inputs contains named input ports.
  // Change typography or return JSX, e.g. <div>{String(state.result)}</div>.
  element.textContent = String(state.result ?? '');
  element.style.font = '24px system-ui';
}`;
export const controlledPaths = ['label', 'description', 'value', 'width', 'height', 'visuals.background', 'visuals.foreground', 'visuals.radius', 'visuals.showHeader', 'visuals.showLabel', 'visuals.showValue', 'visuals.showPortLabels'] as const;
export type ControlledPath = typeof controlledPaths[number];
export const isControlled = (data: BlockData, path: string) => data.controlledProperties?.includes(path as ControlledPath) ?? false;

export function completeFunction(source: string, name: 'run' | 'render'): string {
  if (new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source)) return source.trim().replace(/^export\s+(?:default\s+)?/, '');
  return `async function ${name}() {\n${source.split('\n').map(line => '  ' + line).join('\n')}\n}`;
}
export function insertFunctionSnippet(source: string, snippet: string): string {
  const closing = source.lastIndexOf('}');
  return closing < 0 ? source + '\n' + snippet : source.slice(0, closing) + '\n' + snippet.split('\n').map(line => '  ' + line).join('\n') + '\n' + source.slice(closing);
}

// The lifecycle adapter stays out of the two user-editable function bodies.
export function buildBlockModule(logic: string, renderSource: string): string {
  const runSource = completeFunction(logic, 'run');
  const drawSource = completeFunction(renderSource, 'render');
  const source = `export default async function mount(api) {
  let { inputs, variables, value } = api;
  const { element, state, modules, emit, emitEvent, setValue, setProperty, wasm, ports } = api;
  const { React, Button, Slider, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, latex } = api.ui ?? {};
  let reactRoot;
  let cleanup;
  let disposers = [];
  const onCleanup = fn => disposers.push(fn);
  async function render() {
    if (typeof cleanup === 'function') await cleanup();
    cleanup = undefined;
    const result = await draw();
    if (React?.isValidElement(result) || Array.isArray(result)) {
      reactRoot ??= api.ui.createRoot(element);
      reactRoot.render(result);
    } else { cleanup = result; }
  }
  const draw = (${drawSource});
  ${runSource}
  async function execute() {
    for (const dispose of disposers.splice(0)) await dispose();
    await run();
  }
  await execute();
  return {
    async update(nextInputs, nextValue, nextVariables) {
      inputs = nextInputs; value = nextValue; variables = nextVariables;
      await execute();
    },
    async destroy() { reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); if (typeof cleanup === 'function') await cleanup(); }
  };
}`;
  return transform(source, { transforms: ['jsx'], jsxRuntime: 'classic', production: true, disableESTransforms: true }).code;
}
