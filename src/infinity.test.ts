import { expect,it } from 'vitest';
import * as math from './math-library.js';
import { stringifySignal,parseSignal } from './signal-json';
import { isSignal,signalsEqual } from './runtime';
import { exampleDiagram,parseDiagram,serializeDiagram,makeNode } from './model';
import { sandbox } from './test-utils/module-sandbox';
import { buildBlockModule } from './block-code';
await math.ready;
it('parses inf notation and keeps infinity through transpose and masked softmax',()=>{
  const a=math.parse('[[2,-inf,0],[0,2,0],[0,0,1]]');
  expect(a[0][1]).toBe(-Infinity);
  expect(math.transpose(a)).toEqual([[2,0,0],[-Infinity,2,0],[0,0,1]]);
  expect(math.softmax(a)[0][1]).toBe(0);
  for(const token of ['inf','+inf','Infinity','∞'])expect(math.parse(token)).toBe(Infinity);
  for(const token of ['-inf','-Infinity','-∞'])expect(math.parse(token)).toBe(-Infinity);
  expect(()=>math.parse('[[2,NaN]]')).toThrow();
});
it('round trips infinity in saved state without turning it into null',()=>{
  const d=exampleDiagram();d.nodes[0].data.state={matrix:[[2,-Infinity,0]],positive:Infinity};
  const encoded=serializeDiagram(d);
  expect(encoded).toContain('"$number": "-Infinity"');
  expect(parseDiagram(encoded).nodes[0].data.state).toEqual(d.nodes[0].data.state);
  expect(parseSignal(stringifySignal({value:Infinity}))).toEqual({value:Infinity});
  expect(isSignal([-Infinity,Infinity])).toBe(true);expect(isSignal(NaN)).toBe(false);
  expect(signalsEqual(Infinity,null)).toBe(false);expect(signalsEqual(Infinity,-Infinity)).toBe(false);
});
it('preserves observed infinity values across the actual sandbox JSON snapshot bridge',async()=>{
  const run=await sandbox(buildBlockModule('emit(state.result); await render();','element.textContent=String(state.result[0][1]);'),[],{result:[[2,-Infinity,0]]});
  await run.send('');
  expect(run.messages.filter(m=>m.type==='mask-error')).toEqual([]);
  expect(run.messages).toContainEqual({type:'mask-output',token:'session',port:'out-0',value:[[2,-Infinity,0]]});
  expect(run.element.textContent).toBe('-Infinity');run.dispose();
});
it('stores parent interfaces as compact real port markers',()=>{
  const parent=makeNode('subsystem',{x:0,y:0});
  const interfaces=parent.data.canvas!.nodes.filter(n=>['inport','outport'].includes(n.data.kind));
  expect(interfaces.map(n=>[n.width,n.height])).toEqual([[28,28],[28,28]]);
  const d={...exampleDiagram(),nodes:[parent],edges:[]};
  const restored=parseDiagram(serializeDiagram(d));
  expect(restored.nodes[0].data.ports).toEqual(parent.data.ports);
  expect(restored.nodes[0].data.canvas?.edges).toEqual(parent.data.canvas!.edges);
});

it('does not reuse a cached infinity output when the signal becomes null',async()=>{
  const {ProjectEngine}=await import('./project/engine');const {compileProject,nodeKey}=await import('./project/graph');
  const node=makeNode('javascript',{x:0,y:0},'source');const d={...exampleDiagram(),modules:[],nodes:[node],edges:[]};
  const plan=compileProject(d),engine=new ProjectEngine({},[]),id=nodeKey([],'source');
  expect((await engine.execute(plan,{[id]:{values:{'out-0':Infinity}}})).nodes[id].outputs['out-0']).toBe(Infinity);
  expect((await engine.execute(plan,{[id]:{values:{'out-0':null}}})).nodes[id].outputs['out-0']).toBeNull();
  await engine.dispose();
});
