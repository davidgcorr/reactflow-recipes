import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { defaultModule } from '@/model';
import type { Preview, Signal } from '@/runtime';
export const PreviewContext = createContext<{ values: Preview; emit: (id: string, port: string, value: Signal) => void }>({ values: {}, emit: () => {} });
export function moduleDocument(source: string): string {
  const encoded = JSON.stringify(source).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><style>html,body,#mask{margin:0;width:100%;height:100%;overflow:hidden}body{font:12px system-ui}#mask{display:grid;place-items:center}pre{white-space:pre-wrap;color:#dc2626;font:10px monospace;padding:8px}</style></head><body><div id="mask"></div><script type="module">
const element = document.getElementById('mask');
const report = error => { element.replaceChildren(); const p=document.createElement('pre');p.textContent=error.message || String(error);element.append(p); };
addEventListener('error', e=>report(e.error || e.message));
addEventListener('unhandledrejection', e=>report(e.reason));
let mount, current, pending, running = false;
const emit = (value, port = 'out-0') => { if (value === null || typeof value === 'boolean' || typeof value === 'string' && value.length < 10000 || typeof value === 'number' && Number.isFinite(value)) parent.postMessage({type:'mask-output', port, value}, '*'); };
async function flush() {
 if(running || !mount) return; running=true;
 try { while(pending) {
   const next=pending; pending=null;
   document.body.style.color=next.color; element.style.background=next.background;
   if(current && typeof current.update === 'function') await current.update(next.inputs, next.value);
   else {
     if(typeof current === 'function') await current(); else if(current?.destroy) await current.destroy();
     element.replaceChildren(); current=await mount({element,inputs:next.inputs,value:next.value,emit});
   }
 } } catch(error) { report(error); } finally { running=false; }
}
addEventListener('message', e=>{if(e.source===parent && e.data?.type==='mask-input'){pending=e.data;flush();}});
try { const url=URL.createObjectURL(new Blob([${encoded}],{type:'text/javascript'})); const module=await import(url);URL.revokeObjectURL(url);mount=module.default;if(typeof mount!=='function')throw new Error('Export a default mount function.'); parent.postMessage({type:'mask-ready'}, '*');flush(); } catch(error){report(error);}
</script></body></html>`;
}
export function ModuleMask({ id, source, value, color, background }: { id: string; source?: string; value: string; color: string; background: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { values, emit } = useContext(PreviewContext);
  const inputs = JSON.stringify(values[id]?.inputs ?? {});
  const resolvedColor = frame.current ? getComputedStyle(frame.current).color : color;
  const srcDoc = useMemo(() => moduleDocument(source ?? defaultModule), [source]);
  const latest = useRef({ inputs, value, color, background }); latest.current = { inputs, value, color: resolvedColor, background };
  useEffect(() => {
    const send = () => { const data = latest.current; frame.current?.contentWindow?.postMessage({ type: 'mask-input', ...data, color: frame.current ? getComputedStyle(frame.current).color : data.color, inputs: JSON.parse(data.inputs) }, '*'); };
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'mask-ready') send();
      if (e.data?.type === 'mask-output' && typeof e.data.port === 'string') {
        const v = e.data.value;
        if (v === null || typeof v === 'boolean' || typeof v === 'string' && v.length < 10000 || typeof v === 'number' && Number.isFinite(v)) emit(id, e.data.port, v);
      }
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [id, emit]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: 'mask-input', inputs: JSON.parse(inputs), value, color: resolvedColor, background }, '*'); }, [inputs, value, resolvedColor, background, srcDoc]);
  return <iframe ref={frame} title="JavaScript block mask" className="module-mask nodrag nopan nowheel" sandbox="allow-scripts" srcDoc={srcDoc}/>;
}
