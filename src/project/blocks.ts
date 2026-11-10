import { validVariable } from '../code-config';
import { makeNode, type BlockNode, type Port } from '../model';
import type { ExportInfo } from './engine';
import type { Operation, ProjectModule } from './schema';
export function operationPorts(type: Operation['type'], args: string[]): Port[] {
  const inputs: Port[] = [];
  if (type === 'method' || type === 'property') inputs.push({ id: 'object', name: 'object', variable: 'object', side: 'left', type: 'input' });
  const used = new Set(['object', 'trigger']);
  args.forEach((name, i) => { const variable = validVariable(name) && !used.has(name) ? name : `argument${i + 1}`; used.add(variable); inputs.push({ id: `arg-${i}`, name, variable, side: 'left', type: 'input' }); });
  if (type === 'method' || type === 'function' || type === 'code') inputs.push({ id: 'trigger', name: 'trigger / after', variable: 'trigger', side: 'top', type: 'input' });
  const outputs: Port[] = [{ id: 'result', name: type === 'construct' ? 'instance' : 'result', variable: 'result', side: 'right', type: 'output' }];
  if (type === 'method') outputs.push({ id: 'instance', name: 'same object', variable: 'instance', side: 'right', type: 'output' });
  if (type === 'method' || type === 'function' || type === 'code') outputs.push({ id: 'done', name: 'done', variable: 'done', side: 'bottom', type: 'output' });
  return [...inputs, ...outputs];
}
export function makeOperationBlock(module: ProjectModule | undefined, entry: ExportInfo | undefined, position: { x: number; y: number }, method?: ExportInfo['methods'][number], property?: string): BlockNode {
  const node = makeNode('compute', position);
  const type: Operation['type'] = property ? 'property' : method ? 'method' : entry?.kind === 'class' ? 'construct' : entry?.kind === 'value' ? 'export' : 'function';
  const args = property ? [] : method?.args ?? entry?.args ?? [];
  node.data.operation = { type, effect: type === 'method' ? 'step' : 'pure', ...(module ? { moduleId: module.id } : {}), ...(entry ? { exportName: entry.name } : {}), ...(method ? { member: method.name } : property ? { member: property } : {}) };
  node.data.label = property ?? method?.name ?? entry?.name ?? 'Call function'; node.data.value = '[]';
  node.data.ports = operationPorts(type, args);
  return node;
}
