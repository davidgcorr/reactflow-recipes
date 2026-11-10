import { ProjectEngine } from './engine';
import { ModuleLoader } from './loader';
import type { ProjectPlan } from './graph';
import type { ExternalValue } from './engine';
let engine: ProjectEngine | undefined, loader: ModuleLoader | undefined;
let pending: { id: number; plan: ProjectPlan; external: Record<string, ExternalValue>; mode: 'live' | 'step' } | undefined;
let running = false;
async function flush() {
  if (running) return; running = true;
  try {
    while (pending) {
      const request = pending; pending = undefined;
      try {
        if (!engine) {
          loader = new ModuleLoader(request.plan.modules);
          engine = new ProjectEngine(await loader.load(), request.plan.modules);
          for (const node of request.plan.nodes) if (node.data.operation?.type === 'code') engine.setCode(node.id, await loader.code(node.data.module ?? ''));
        }
        const result = await engine.execute(request.plan, request.external, request.mode);
        postMessage({ type: 'result', id: request.id, result });
      } catch (error) { postMessage({ type: 'error', id: request.id, error: error instanceof Error ? error.message : String(error) }); }
    }
  } finally { running = false; }
}
addEventListener('message', event => {
  if (event.data?.type === 'execute') { pending = event.data; void flush(); }
});
postMessage({ type: 'ready' });
