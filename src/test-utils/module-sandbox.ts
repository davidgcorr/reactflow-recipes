import { moduleDocument, type ModuleOptions } from '../components/module-mask';
import { makeNode } from '../model';
import type { Signal } from '../runtime';
import type { ModuleDependency } from '../code-config';
// Exercise the actual generated sandbox bootstrap without a browser: replace only
// the module transport, keeping its lifecycle, mappings and message protocol.
export async function sandbox(source: string, dependencies: ModuleDependency[] = [], initialState?: Record<string, Signal>, options: Partial<ModuleOptions> & { element?: HTMLElement; ui?: Record<string, unknown> } = {}) {
  const messages: any[] = [], listeners: Record<string, (e: any) => void> = {}, blobs = new Map<string, Blob>(), imports: Record<string, string> = {};
  const stubElement = { textContent: '', style: {}, children: [] as any[], append(child: any) { this.children.push(child); }, replaceChildren() { this.children = []; } };
  const element = options.element ?? stubElement;
  const document = { getElementById: () => element, body: { style: {} }, createElement: (tag: string) => options.element ? globalThis.document.createElement(tag) : ({ type: '', textContent: '' }), head: { append(map: any) { Object.assign(imports, JSON.parse(map.textContent).imports); } } };
  const parent = { postMessage(message: any) { messages.push(structuredClone(message)); } };
  const url = { createObjectURL(blob: Blob) { const key = `test:${blobs.size}`; blobs.set(key, blob); return key; }, revokeObjectURL() {} };
  const importModule = async (specifier: string) => {
    const blob = blobs.get(imports[specifier] ?? specifier); if (!blob) throw new Error(`Unknown module ${specifier}`);
    const source = await blob.text();
    if (options.ui && source === 'test-ui') return options.ui;
    return import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  };
  const ports = makeNode('javascript', { x: 0, y: 0 }).data.ports;
  ports[0].variable = 'signal'; ports[1].variable = 'result';
  const html = moduleDocument(source, { dependencies, ports, state: initialState, token: 'session', ...(options.renderer ? { renderer: options.renderer } : {}), ...(options.ports ? { ports: options.ports } : {}), ...(options.ui ? { uiSource: 'test-ui' } : {}) });
  const script = html.split('<script type="module">')[1].split('</script>')[0].replaceAll('await import(name)', 'await importModule(name)').replaceAll('await import(url)', 'await importModule(url)').replaceAll('await import(uiUrl)', 'await importModule(uiUrl)');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('document', 'parent', 'addEventListener', 'URL', 'importModule', script)(document, parent, (name: string, callback: (event: any) => void) => { listeners[name] = callback; }, url, importModule);
  const send = async (value: string, input: unknown = 3) => {
    listeners.message({ source: parent, data: { type: 'mask-input', value, inputs: options.ports ? input : { 'in-0': input }, color: '#123456', background: '#ffffff' } });
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  return { messages, element, send, dispose: () => listeners.pagehide({}) };
}

