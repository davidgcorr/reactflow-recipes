import { interfacePorts, makeNode, type Diagram } from '../model';
import { makeOperationBlock } from './blocks';
import { exampleModuleSource, type ProjectModule } from './schema';
export function sharedModulesExample(): Diagram {
  const module: ProjectModule = { id: 'math-module', alias: 'math', source: exampleModuleSource };
  const imported = makeNode('module', { x: 20, y: 20 }, 'import'); imported.data.projectModuleId = module.id; imported.data.label = 'Project math library';
  const a = makeNode('constant', { x: 20, y: 220 }, 'matrix-a'); a.data.value = '[[1,2],[3,4]]'; a.data.label = 'Matrix A';
  const b = makeNode('constant', { x: 20, y: 430 }, 'matrix-b'); b.data.value = '[[5],[6]]'; b.data.label = 'Matrix B';
  const multiply = makeOperationBlock(module, { name: 'matmul', kind: 'function', args: ['a', 'b'], methods: [] }, { x: 330, y: 250 }); multiply.id = 'matmul';
  const matrixView = makeNode('renderer', { x: 660, y: 240 }, 'matrix-view'); matrixView.data.label = 'Expected: 17, 39';
  const instance = makeOperationBlock(module, { name: 'Accumulator', kind: 'class', args: ['initial'], methods: [] }, { x: 20, y: 740 }); instance.id = 'instance'; instance.data.value = '[10]';
  const first = makeOperationBlock(module, undefined, { x: 330, y: 740 }, { name: 'add', args: ['amount'] }); first.id = 'first-add'; first.data.value = '[2]'; first.data.label = 'Add 2 on each Step';
  const parent = makeNode('subsystem', { x: 670, y: 740 }, 'nested'); parent.data.label = 'Nested: add 3 after first';
  const input = makeNode('inport', { x: 20, y: 100 }, 'object-in'); input.data.label = 'Shared instance';
  const trigger = makeNode('inport', { x: 20, y: 300 }, 'after-in'); trigger.data.label = 'After'; trigger.data.exposedSide = 'top';
  const second = makeOperationBlock(module, undefined, { x: 330, y: 150 }, { name: 'add', args: ['amount'] }); second.id = 'second-add'; second.data.value = '[3]';
  const output = makeNode('outport', { x: 700, y: 150 }, 'result-out'); output.data.label = 'Value';
  const edge = (id: string, source: string, target: string, sourceHandle: string, targetHandle: string) => ({ id, source, target, sourceHandle, targetHandle, type: 'smoothstep' });
  parent.data.canvas = { nodes: [input, trigger, second, output], edges: [edge('object-method', input.id, second.id, 'out-0', 'object'), edge('after-method', trigger.id, second.id, 'out-0', 'trigger'), edge('method-out', second.id, output.id, 'result', 'in-0')], viewport: { x: 30, y: 100, zoom: 0.8 } }; parent.data.ports = interfacePorts(parent.data.canvas);
  const valueView = makeNode('renderer', { x: 1020, y: 730 }, 'instance-view'); valueView.data.label = 'Step: 15, then 20, then 25…';
  const code = makeNode('compute', { x: 330, y: 20 }, 'shared-code'); code.data.label = 'Code uses the same module'; code.data.module = 'export function run({ modules }) { return { result: modules.math.add(20, 22) }; }'; code.data.ports = code.data.ports.filter(p => p.type === 'output'); code.data.operation!.uses = ['math'];
  const codeView = makeNode('renderer', { x: 660, y: 0 }, 'code-view'); codeView.data.label = 'Expected: 42';
  return { version: 1, name: 'Shared modules and live instances', modules: [module], nodes: [imported, a, b, multiply, matrixView, instance, first, parent, valueView, code, codeView], edges: [edge('a-multiply', a.id, multiply.id, 'out-0', 'arg-0'), edge('b-multiply', b.id, multiply.id, 'out-0', 'arg-1'), edge('multiply-view', multiply.id, matrixView.id, 'result', 'in-0'), edge('instance-first', instance.id, first.id, 'result', 'object'), edge('first-nested', first.id, parent.id, 'instance', input.id), edge('after-nested', first.id, parent.id, 'done', trigger.id), edge('nested-view', parent.id, valueView.id, output.id, 'in-0'), edge('code-view', code.id, codeView.id, 'result', 'in-0')], viewport: { x: 250, y: 80, zoom: 0.65 } };
}
