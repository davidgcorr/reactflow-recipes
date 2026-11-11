import { signalReplacer, signalReviver, stringifySignal, parseSignal } from '@/signal-json';
import sandboxStyles from '../sandbox-ui.css?raw';
import { ProjectContext } from '@/project/context';
import { buildBlockModule } from '@/block-code';
import type { BlockData } from '@/model';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultModule, type Port } from '@/model';
import type { ModuleDependency, WasmConfig, RendererConfig } from '@/code-config';
import { isSignal, type Preview, type Signal } from '@/runtime';
export const PreviewContext = createContext<{ values: Preview; emit: (id: string, port: string, value: Signal, event?: boolean) => void; setValue: (id: string, value: string) => void; saveState: (id: string, state: Record<string, Signal>) => void; setProperty: (id: string, path: string, value: Signal) => void; report: (id: string, error: string) => void }>({ values: {}, emit: () => {}, setValue: () => {}, saveState: () => {}, setProperty: () => {}, report: () => {} });
export type ModuleOptions = { dependencies?: ModuleDependency[]; ports?: Pick<Port, 'id' | 'type' | 'variable'>[]; wasm?: WasmConfig; token?: string; state?: Record<string, Signal>; uiSource?: string; renderer?: RendererConfig };
export function moduleDocument(source: string, options: ModuleOptions = {}): string {
  const encode = (value: unknown) => JSON.stringify(value, signalReplacer).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><style>${sandboxStyles}html,body,#mask{margin:0;width:100%;height:100%;overflow:hidden}body{font:12px system-ui}#mask{display:grid;place-items:center}pre{white-space:pre-wrap;color:#dc2626;font:10px monospace;padding:8px}input,select,button{font:inherit;accent-color:currentColor}button{cursor:pointer}</style></head><body><div id="mask"></div><script type="module">
const wireReplacer = (${signalReplacer.toString()}), wireReviver = (${signalReviver.toString()});
const element = document.getElementById('mask'), config=${encode(options)};
const validSignal=(${isSignal.toString()});
let mount, current, pending, running=false, modules={}, ui, lastInput;
// Observed state contains Proxies, which postMessage cannot structured-clone.
// The wire contract is bounded JSON, so always send a detached JSON snapshot.
const send = data => parent.postMessage(JSON.parse(JSON.stringify({...data, token:config.token}, wireReplacer), wireReviver), '*');
const report = error => { const previous=current;current=undefined;try{const cleanup=typeof previous==='function'?previous():previous?.destroy?.();Promise.resolve(cleanup).catch(()=>{});}catch{} element.replaceChildren(); const p=document.createElement('pre');p.textContent=error?.message || String(error);element.append(p);send({type:'mask-error',error:error?.message || String(error)}); };
addEventListener('error', e=>report(e.error || e.message));
addEventListener('unhandledrejection', e=>report(e.reason));
let stateQueued=false;
const stateTarget=JSON.parse(JSON.stringify(config.state??{}), wireReviver), proxies=new WeakMap();
const persistState=()=>{if(stateQueued)return;stateQueued=true;queueMicrotask(()=>{stateQueued=false;if(validSignal(stateTarget))send({type:'mask-state',state:stateTarget});else report(new Error('State must be bounded JSON data.'));});};
function observe(value){if(!value||typeof value!=='object')return value;if(proxies.has(value))return proxies.get(value);const proxy=new Proxy(value,{get:(target,key)=>observe(target[key]),set(target,key,value){if(['__proto__','constructor','prototype'].includes(String(key)))throw new Error('Invalid state key');target[key]=value;persistState();return true;},deleteProperty(target,key){delete target[key];persistState();return true;}});proxies.set(value,proxy);return proxy;}
const state=observe(stateTarget);
const setProperty=(path,value)=>{if(typeof path==='string'&&validSignal(value))send({type:'mask-property',path,value});};
const outputPorts=(config.ports??[]).filter(p=>p.type==='output');
const emit=(value, port=outputPorts[0]?.id??'out-0', event=false)=>{const resolved=outputPorts.find(p=>p.variable===port)?.id??port;if(validSignal(value))send({type:'mask-output',port:resolved,value,...(event?{event:true}:{})});else report(new Error('Output must be bounded JSON data (numbers (including infinity), strings, arrays, or objects; NaN is not supported).'));};
const emitEvent=(value,port)=>emit(value,port,true);
const setValue=value=>{if(typeof value==='string'&&value.length<=100000)send({type:'mask-value',value});};
async function flush() {
 if(running || !mount) return; running=true;
 try { while(pending) {
   const next=pending;pending=null;
   const inputKey=JSON.stringify([next.inputs,next.value,next.color,next.background], wireReplacer);
   const stateChanged=next.state&&JSON.stringify(next.state,wireReplacer)!==JSON.stringify(stateTarget,wireReplacer);
   if(lastInput===inputKey&&!stateChanged&&current)continue;
   if(stateChanged){for(const key of Object.keys(stateTarget))delete stateTarget[key];Object.assign(stateTarget,next.state);}
   lastInput=inputKey;
   send({type:'mask-status',error:''});
   document.body.style.color=next.color;element.style.background=next.background;
   const inputs={...next.inputs},variables={};
   for(const p of config.ports??[])if(p.type==='input'&&p.variable){inputs[p.variable]=next.inputs[p.id]??null;variables[p.variable]=next.inputs[p.id]??null;}
   if(current && typeof current.update==='function')await current.update(inputs,next.value,variables);
   else {
     if(typeof current==='function')await current();else if(current?.destroy)await current.destroy();
     element.replaceChildren();current=await mount({element,inputs,variables,value:next.value,emit,emitEvent,setValue,modules,state,setProperty,ui,renderer:config.renderer,wasm:config.wasm,ports:config.ports});
   }
 } } catch(error) { report(error); } finally { running=false; }
}
addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='mask-input'){pending=e.data;flush();}});
const urls=[];
addEventListener('pagehide',()=>{if(typeof current==='function')current();else current?.destroy?.();urls.forEach(url=>URL.revokeObjectURL(url));});
try {
 if(config.uiSource){const uiUrl=URL.createObjectURL(new Blob([config.uiSource],{type:'text/javascript'}));urls.push(uiUrl);ui=await import(uiUrl);}
 const imports=Object.create(null);
 for(const d of config.dependencies??[]){if(d.url)imports[d.specifier]=d.url;else{const url=URL.createObjectURL(new Blob([d.source],{type:'text/javascript'}));urls.push(url);imports[d.specifier]=url;}}
 const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
 modules=Object.fromEntries(await Promise.all(Object.keys(imports).map(async name=>[name,await import(name)])));
 for(const namespace of Object.values(modules)){if(namespace.tf){await namespace.ready;modules.tf??=namespace.tf;modules.tensorMath??=namespace;}}
 const url=URL.createObjectURL(new Blob([${encode(source)}],{type:'text/javascript'}));urls.push(url);const module=await import(url);mount=module.default;
 if(typeof mount!=='function')throw new Error('Export a default mount function.');send({type:'mask-ready'});flush();
} catch(error){report(error);}
</script></body></html>`;
}
let renderBundle: Promise<string> | undefined;
export const loadRenderBundle = () => renderBundle ??= import('../generated/block-ui.js?raw').then(module => module.default).catch(error => { renderBundle = undefined; throw error; });
let mathBundle: Promise<string> | undefined;
export const loadMathBundle = () => mathBundle ??= import('../generated/block-math.js?raw').then(m => m.default).catch(error => { mathBundle = undefined; throw error; });
export function ModuleMask({ id, source, render, state, value, color, background, ports, dependencies, wasm, renderer, interactive = false }: { id: string; source?: string; render?: string; state?: BlockData['state']; value: string; color: string; background: string; ports: Port[]; dependencies?: ModuleDependency[]; wasm?: WasmConfig; renderer?: RendererConfig; interactive?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { values, emit, setValue, saveState, setProperty, report } = useContext(PreviewContext);
  const project = useContext(ProjectContext);
  const builtins = project.modules.filter(m => m.builtin);
  const [mathSource, setMathSource] = useState<string>();
  const shared = project.modules.filter(m => !m.builtin).flatMap(m => [...(m.dependencies ?? []), { specifier: m.alias, ...(m.url ? { url: m.url } : { source: m.source }) }]);
  const allDependencies = [...new Map([...(dependencies ?? []), ...shared, ...builtins.map(m => ({ specifier: m.alias, source: '' }))].map(d => [d.specifier, d])).values()];
  const savedState = useRef<BlockData['state']>(undefined);
  const stateInput = state === savedState.current ? undefined : state;
  const initialState = useRef(state); initialState.current = state;
  const inputs = stringifySignal(values[id]?.inputs ?? {});
  const settings = JSON.stringify({ dependencies: allDependencies, ports: ports.map(({ id, type, variable }) => ({ id, type, variable })), wasm, renderer });
  const code = useMemo(() => {
    try { return render !== undefined ? buildBlockModule(source ?? '', render) : source ?? defaultModule; }
    catch (error) { return `export default function(){throw new Error(${JSON.stringify(String(error))});}`; }
  }, [source, render]);
  const needsUI = /React\.createElement|\blatex\s*\(/.test(code);
  const [uiSource, setUISource] = useState<string>();
  const needsMath = builtins.length > 0;
  useEffect(() => { let active = true; if (needsMath) void loadMathBundle().then(source => { if (active) setMathSource(source); }).catch(error => { if (active) report(id, String(error)); }); return () => { active = false; }; }, [needsMath, id, report]);
  const [uiError, setUIError] = useState('');
  useEffect(() => { let active = true; if (needsUI) void loadRenderBundle().then(source => { if (active) { setUISource(source); setUIError(''); } }).catch(error => { if (active) { setUIError('Could not load renderer.'); report(id, String(error)); } }); return () => { active = false; }; }, [needsUI, id, report]);
  const document = useMemo(() => {
    const token = crypto.randomUUID();
    // Keep the large bundled library out of settings serialized on every live update.
    // Inject it only when this iframe document actually needs rebuilding.
    const options = JSON.parse(settings);
    options.dependencies = options.dependencies.map((dependency: ModuleDependency) => builtins.some(m => m.alias === dependency.specifier) ? { ...dependency, source: mathSource ?? '' } : dependency);
    return { token, source: (needsUI && !uiSource || needsMath && !mathSource) ? `<!doctype html><html><body style="font:11px system-ui;color:#737373">${uiError || 'Loading renderer…'}</body></html>` : moduleDocument(code, { ...options, state: initialState.current, ...(needsUI ? { uiSource } : {}), token }) };
  }, [code, settings, needsUI, uiSource, uiError, needsMath, mathSource]);
  const latest = useRef({ inputs, value, color, background, state }); latest.current = { inputs, value, color, background, state: stateInput };
  const token = useRef(document.token); token.current = document.token;
  useEffect(() => {
    const send = () => { const data = latest.current; frame.current?.contentWindow?.postMessage({ type: 'mask-input', ...data, color: frame.current ? getComputedStyle(frame.current).color : data.color, inputs: parseSignal(data.inputs) }, '*'); };
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.token !== token.current) return;
      if (e.data.type === 'mask-ready') send();
      if (e.data.type === 'mask-output' && typeof e.data.port === 'string' && isSignal(e.data.value)) emit(id, e.data.port, e.data.value, e.data.event === true);
      if (e.data.type === 'mask-value' && typeof e.data.value === 'string' && e.data.value.length <= 100000) setValue(id, e.data.value);
      if (e.data.type === 'mask-state' && isSignal(e.data.state) && e.data.state && !Array.isArray(e.data.state) && typeof e.data.state === 'object') { savedState.current = e.data.state; saveState(id, e.data.state); }
      if (e.data.type === 'mask-property' && typeof e.data.path === 'string' && isSignal(e.data.value)) setProperty(id, e.data.path, e.data.value);
      if (e.data.type === 'mask-status') report(id, '');
      if (e.data.type === 'mask-error') report(id, String(e.data.error ?? 'JavaScript error'));
      if (e.data.type === 'mask-error') ports.filter(p => p.type === 'output').forEach(p => emit(id, p.id, null));
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [id, emit, setValue, saveState, setProperty, report, settings]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: 'mask-input', inputs: parseSignal(inputs), state: stateInput, value, color: frame.current ? getComputedStyle(frame.current).color : color, background }, '*'); }, [inputs, state, value, color, background, document]);
  return <iframe key={document.token} ref={frame} title="JavaScript block mask" className={`module-mask ${interactive ? 'mask-interactive nodrag nopan nowheel' : ''}`} tabIndex={interactive ? 0 : -1} sandbox="allow-scripts" srcDoc={document.source}/>;
}
