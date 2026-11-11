import { stringifySignal } from '../signal-json';
import { jsRecipes } from '../js-recipes';
import { canvasAt, type BlockData, type Canvas, type Diagram, type Port } from '../model';
import type { ProjectModule } from './schema';
export type Link = { node: string; port: string };
export type RuntimeNode = { id: string; data: Pick<BlockData, 'kind' | 'value' | 'module' | 'operation' | 'recipe' | 'renderer' | 'ports'> & { nativeRecipe?: boolean }; inputs: Record<string, Link>; aliases: Record<string, Link> };
export type ProjectPlan = { modules: ProjectModule[]; nodes: RuntimeNode[] };
export const nodeKey = (path: string[], id: string) => stringifySignal([...path, id]);
export function compileProject(project: Diagram): ProjectPlan {
  const nodes: RuntimeNode[] = [];
  function resolve(canvas: Canvas, path: string[], id: string, port: string, seen = new Set<string>()): Link | undefined {
    const key = stringifySignal([path, id, port]); if (seen.has(key)) throw new Error('Cyclic nested interface wiring.'); seen.add(key);
    const node = canvas.nodes.find(n => n.id === id); if (!node) return;
    if (node.data.canvas) {
      const outport = node.data.canvas.nodes.find(n => n.id === port && n.data.kind === 'outport');
      const edge = outport && node.data.canvas.edges.find(e => e.target === outport.id);
      return edge ? resolve(node.data.canvas, [...path, id], edge.source, edge.sourceHandle!, seen) : undefined;
    }
    if (node.data.kind === 'inport' && path.length) {
      const parentPath = path.slice(0, -1), parentId = path.at(-1)!;
      const parent = canvasAt(project, parentPath), edge = parent.edges.find(e => e.target === parentId && e.targetHandle === id);
      return edge ? resolve(parent, parentPath, edge.source, edge.sourceHandle!, seen) : undefined;
    }
    return { node: nodeKey(path, id), port };
  }
  function visit(canvas: Canvas, path: string[]) {
    for (const node of canvas.nodes) {
      const { kind, value, module, operation, recipe, renderer, ports } = node.data;
      const inputs: Record<string, Link> = {}, aliases: Record<string, Link> = {};
      for (const p of ports.filter(p => p.type === 'input')) {
        const edge = canvas.edges.find(e => e.target === node.id && e.targetHandle === p.id);
        const link = edge && resolve(canvas, path, edge.source, edge.sourceHandle!);
        if (link) inputs[p.id] = link;
      }
      if (kind === 'inport' || node.data.canvas) for (const p of ports.filter(p => p.type === 'output')) {
        const link = resolve(canvas, path, node.id, p.id); if (link && link.node !== nodeKey(path, node.id)) aliases[p.id] = link;
      }
      const cleanPorts: Port[] = ports.map(({ id, type, variable, name, side }) => ({ id, type, name, side, ...(variable ? { variable } : {}) }));
      nodes.push({ id: nodeKey(path, node.id), data: { kind, value, ...(kind === 'compute' ? { module, operation } : {}), recipe, nativeRecipe: kind === 'javascript' && !!recipe && Object.hasOwn(jsRecipes, recipe) && module === jsRecipes[recipe as keyof typeof jsRecipes].source, renderer, ports: cleanPorts }, inputs, aliases });
      if (node.data.canvas) visit(node.data.canvas, [...path, node.id]);
    }
  }
  visit(project, []); return { modules: project.modules ?? [], nodes };
}
// Positions, labels, port sides, and view settings do not change computation identity.
export function definitionKey(plan: ProjectPlan) {
  return stringifySignal({ modules: plan.modules, nodes: plan.nodes.map(n => ({ id: n.id, kind: n.data.kind, module: n.data.module, operation: n.data.operation, recipe: n.data.recipe, nativeRecipe: n.data.nativeRecipe, ports: n.data.ports.map(p => [p.id, p.type, p.variable]), inputs: n.inputs, aliases: n.aliases })) });
}
export function executionKey(plan: ProjectPlan) {
  return stringifySignal([definitionKey(plan), plan.nodes.map(n => [n.id, n.data.value, n.data.renderer])]);
}
