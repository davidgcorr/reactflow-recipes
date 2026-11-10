import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { defaultModule, type Port } from '@/model';
import type { ModuleDependency, WasmConfig } from '@/code-config';
import { isSignal, type Preview, type Signal } from '@/runtime';
export const PreviewContext = createContext<{ values: Preview; emit: (id: string, port: string, value: Signal) => void; setValue: (id: string, value: string) => void }>({ values: {}, emit: () => {}, setValue: () => {} });
export type ModuleOptions = { dependencies?: ModuleDependency[]; ports?: Pick<Port, 'id' | 'type' | 'variable'>[]; wasm?: WasmConfig; token?: string };
export function moduleDocument(source: string, options: ModuleOptions = {}): string {
  const encode = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><style>html,body,#mask{margin:0;width:100%;height:100%;overflow:hidden}body{font:12px system-ui}#mask{display:grid;place-items:center}pre{white-space:pre-wrap;color:#dc2626;font:10px monospace;padding:8px}input,select,button{font:inherit;accent-color:currentColor}button{cursor:pointer}</style></head><body><div id="mask"></div><script type="module">
const element = document.getElementById('mask'), config=${encode(options)};
const validSignal=(${isSignal.toString()});
let mount, current, pending, running=false, modules={};
const send = data => parent.postMessage({...data, token:config.token}, '*');
const report = error => { const previous=current;current=undefined;try{const cleanup=typeof previous==='function'?previous():previous?.destroy?.();Promise.resolve(cleanup).catch(()=>{});}catch{} element.replaceChildren(); const p=document.createElement('pre');p.textContent=error?.message || String(error);element.append(p);send({type:'mask-error'}); };
addEventListener('error', e=>report(e.error || e.message));
addEventListener('unhandledrejection', e=>report(e.reason));
const outputPorts=(config.ports??[]).filter(p=>p.type==='output');
const emit=(value, port=outputPorts[0]?.id??'out-0')=>{const resolved=outputPorts.find(p=>p.variable===port)?.id??port;if(validSignal(value))send({type:'mask-output',port:resolved,value});else report(new Error('Output must be bounded JSON data (finite numbers, strings, arrays, or objects).'));};
const setValue=value=>{if(typeof value==='string'&&value.length<=100000)send({type:'mask-value',value});};
async function flush() {
 if(running || !mount) return; running=true;
 try { while(pending) {
   const next=pending;pending=null;
   document.body.style.color=next.color;element.style.background=next.background;
   const inputs={...next.inputs},variables={};
   for(const p of config.ports??[])if(p.type==='input'&&p.variable){inputs[p.variable]=next.inputs[p.id]??null;variables[p.variable]=next.inputs[p.id]??null;}
   if(current && typeof current.update==='function')await current.update(inputs,next.value,variables);
   else {
     if(typeof current==='function')await current();else if(current?.destroy)await current.destroy();
     element.replaceChildren();current=await mount({element,inputs,variables,value:next.value,emit,setValue,modules,wasm:config.wasm,ports:config.ports});
   }
 } } catch(error) { report(error); } finally { running=false; }
}
addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='mask-input'){pending=e.data;flush();}});
const urls=[];
addEventListener('pagehide',()=>{if(typeof current==='function')current();else current?.destroy?.();urls.forEach(url=>URL.revokeObjectURL(url));});
try {
 const imports=Object.create(null);
 for(const d of config.dependencies??[]){if(d.url)imports[d.specifier]=d.url;else{const url=URL.createObjectURL(new Blob([d.source],{type:'text/javascript'}));urls.push(url);imports[d.specifier]=url;}}
 const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
 modules=Object.fromEntries(await Promise.all(Object.keys(imports).map(async name=>[name,await import(name)])));
 const url=URL.createObjectURL(new Blob([${encode(source)}],{type:'text/javascript'}));urls.push(url);const module=await import(url);mount=module.default;
 if(typeof mount!=='function')throw new Error('Export a default mount function.');send({type:'mask-ready'});flush();
} catch(error){report(error);}
</script></body></html>`;
}
export function ModuleMask({ id, source, value, color, background, ports, dependencies, wasm, interactive = false }: { id: string; source?: string; value: string; color: string; background: string; ports: Port[]; dependencies?: ModuleDependency[]; wasm?: WasmConfig; interactive?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { values, emit, setValue } = useContext(PreviewContext);
  const inputs = JSON.stringify(values[id]?.inputs ?? {});
  const settings = JSON.stringify({ dependencies, ports: ports.map(({ id, type, variable }) => ({ id, type, variable })), wasm });
  const document = useMemo(() => { const token = crypto.randomUUID(); return { token, source: moduleDocument(source ?? defaultModule, { ...JSON.parse(settings), token }) }; }, [source, settings]);
  const latest = useRef({ inputs, value, color, background }); latest.current = { inputs, value, color, background };
  const token = useRef(document.token); token.current = document.token;
  useEffect(() => {
    const send = () => { const data = latest.current; frame.current?.contentWindow?.postMessage({ type: 'mask-input', ...data, color: frame.current ? getComputedStyle(frame.current).color : data.color, inputs: JSON.parse(data.inputs) }, '*'); };
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.token !== token.current) return;
      if (e.data.type === 'mask-ready') send();
      if (e.data.type === 'mask-output' && typeof e.data.port === 'string' && isSignal(e.data.value)) emit(id, e.data.port, e.data.value);
      if (e.data.type === 'mask-value' && typeof e.data.value === 'string' && e.data.value.length <= 100000) setValue(id, e.data.value);
      if (e.data.type === 'mask-error') ports.filter(p => p.type === 'output').forEach(p => emit(id, p.id, null));
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [id, emit, setValue, settings]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: 'mask-input', inputs: JSON.parse(inputs), value, color: frame.current ? getComputedStyle(frame.current).color : color, background }, '*'); }, [inputs, value, color, background, document]);
  return <iframe ref={frame} title="JavaScript block mask" className={`module-mask ${interactive ? 'mask-interactive nodrag nopan nowheel' : ''}`} tabIndex={interactive ? 0 : -1} sandbox="allow-scripts" srcDoc={document.source}/>;
}
