import { stringifySignal } from '../signal-json';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Diagram } from '../model';
import { compileProject, definitionKey, executionKey, type ProjectPlan } from './graph';
import type { ExecutionResult, ExternalValue } from './engine';
import { runtimeDocument } from './sandbox';
export function useProjectRuntime(document: Diagram, external: Record<string, ExternalValue>) {
  const [live, setLive] = useState(true), [result, setResult] = useState<ExecutionResult | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [generation, setGeneration] = useState(0), [steps, setSteps] = useState(0);
  let plan: ProjectPlan = { modules: [], nodes: [] }, compileError = '';
  try { plan = compileProject(document); } catch (e) { compileError = e instanceof Error ? e.message : String(e); }
  const enabled = !!document.modules?.length || plan.nodes.some(n => !!n.data.operation);
  const definition = definitionKey(plan), execution = executionKey(plan), externals = stringifySignal(external);
  const frame = useRef<HTMLIFrameElement | null>(null), ready = useRef(false), requestId = useRef(0), pending = useRef<'live' | 'step' | null>(null), inFlight = useRef(false), latest = useRef({ plan, external, live });
  latest.current = { plan, external, live };
  const publish = useCallback((mode: 'live' | 'step') => {
    if (!ready.current || inFlight.current) { pending.current = mode === 'step' || pending.current === 'step' ? 'step' : mode; return; }
    const current = frame.current; if (!current) return;
    inFlight.current = true; setBusy(true);
    current.contentWindow?.postMessage({ type: 'execute', token: current.dataset.token, id: ++requestId.current, plan: latest.current.plan, external: latest.current.external, mode }, '*');
  }, []);
  useEffect(() => {
    if (!enabled || compileError) return;
    let cancelled = false, element: HTMLIFrameElement | undefined;
    const token = crypto.randomUUID(); ready.current = false; inFlight.current = false; pending.current = null; setResult(null); setError(''); setBusy(false);
    const receive = (event: MessageEvent) => {
      if (event.source !== element?.contentWindow || event.data?.token !== token) return;
      const message = event.data;
      if (message.type === 'ready') { ready.current = true; if (latest.current.live || pending.current) { const mode = pending.current ?? 'live'; pending.current = null; publish(mode); } }
      if (message.type === 'fatal') { setError(String(message.error)); setBusy(false); inFlight.current = false; }
      if ((message.type === 'result' || message.type === 'error') && message.id === requestId.current) {
        inFlight.current = false; setBusy(false);
        if (message.type === 'result') { setResult(message.result); setError(''); } else setError(String(message.error));
        const mode = pending.current; pending.current = null; if (mode && (mode === 'step' || latest.current.live)) publish(mode);
      }
    };
    window.addEventListener('message', receive);
    void fetch(`${import.meta.env.BASE_URL}project-runtime.js`).then(async response => {
      if (!response.ok) throw new Error('Build the project runtime with npm run dev or npm run build.');
      const source = await response.text(); if (cancelled) return;
      element = window.document.createElement('iframe'); element.hidden = true; element.title = 'Project computation sandbox'; element.setAttribute('sandbox', 'allow-scripts'); element.dataset.token = token; frame.current = element;
      element.srcdoc = runtimeDocument(source, token); window.document.body.append(element);
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; ready.current = false; element?.contentWindow?.postMessage({ type: 'stop', token }, '*'); element?.remove(); if (frame.current === element) frame.current = null; window.removeEventListener('message', receive); };
  }, [enabled, definition, generation, compileError, publish]);
  useEffect(() => { if (enabled && live && !compileError) publish('live'); }, [enabled, execution, externals, live, generation, compileError, publish]);
  useEffect(() => { if (steps && enabled) publish('step'); }, [steps, enabled, publish]);
  const hasClock = plan.nodes.some(n => n.data.recipe === 'Clock');
  useEffect(() => { if (!live || !enabled || !hasClock) return; const timer = setInterval(() => publish('live'), 50); return () => clearInterval(timer); }, [live, enabled, hasClock, publish]);
  const stop = () => { setLive(false); pending.current = null; inFlight.current = false; setBusy(false); frame.current?.contentWindow?.postMessage({ type: 'stop', token: frame.current.dataset.token }, '*'); setGeneration(g => g + 1); };
  return { enabled, result, error: compileError || error, busy, live, setLive, step: () => setSteps(s => s + 1), reset: () => setGeneration(g => g + 1), stop };
}
