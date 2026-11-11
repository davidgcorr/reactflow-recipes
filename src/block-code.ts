import { transform } from 'sucrase';
import type { BlockData } from './model';

export const defaultLogic = `state.result = inputs.input1 ?? Number(value);
emit(state.result);
await render();`;
export const defaultRender = `// state.result: the value computed in Code; inputs contains named input ports.
// Change typography or return JSX, e.g. <div>{String(state.result)}</div>.
element.textContent = String(state.result ?? '');
element.style.font = '24px system-ui';`;
export const controlledPaths = ['label', 'description', 'value', 'width', 'height', 'visuals.background', 'visuals.foreground', 'visuals.radius', 'visuals.showHeader', 'visuals.showLabel', 'visuals.showValue', 'visuals.showPortLabels'] as const;
export type ControlledPath = typeof controlledPaths[number];
export const isControlled = (data: BlockData, path: string) => data.controlledProperties?.includes(path as ControlledPath) ?? false;

// The lifecycle adapter stays out of the two user-editable function bodies.
export function buildBlockModule(logic: string, renderSource: string): string {
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
    const result = await (async () => {\n${renderSource}\n})();
    if (React?.isValidElement(result) || Array.isArray(result)) {
      reactRoot ??= api.ui.createRoot(element);
      reactRoot.render(result);
    } else { cleanup = result; }
  }
  async function run() {
    for (const dispose of disposers.splice(0)) await dispose();\n${logic}\n}
  await run();
  return {
    async update(nextInputs, nextValue, nextVariables) {
      inputs = nextInputs; value = nextValue; variables = nextVariables;
      await run();
    },
    async destroy() { reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); if (typeof cleanup === 'function') await cleanup(); }
  };
}`;
  return transform(source, { transforms: ['jsx'], jsxRuntime: 'classic', production: true, disableESTransforms: true }).code;
}
