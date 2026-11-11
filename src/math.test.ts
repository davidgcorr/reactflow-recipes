import { describe, expect, it } from 'vitest';
import mathSource from './math-library.js?raw';
import { buildBlockModule } from './block-code';
import { jsRecipes, makeJsNode } from './js-recipes';
import { exampleDiagram, parseDiagram, serializeDiagram } from './model';
import { mathLibrary } from './default-libraries';
import katex from 'katex';
const math = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(mathSource).toString('base64')}`);

describe('numeric kernels for a transformer forward pass', () => {
  it('multiplies matrices and contracts shaped tensors', () => {
    expect(math.matmul([[1,2],[3,4]], [[5],[6]])).toEqual([[17],[39]]);
    expect(math.tensorContract({shape:[2,2],data:[1,2,3,4]}, [[5],[6]])).toEqual([[17],[39]]);
    expect(math.tensorContract([1,2,3], [4,5,6])).toBe(32);
    expect(() => math.matmul([[1,2]], [[1,2]])).toThrow('dimensions');
    expect(() => math.reshape([[1],[2,3]], [3])).toThrow('rectangular');
  });
  it('broadcasts bias vectors and scalars and computes cross products', () => {
    expect(math.add([[1,2],[3,4]],[10,20])).toEqual([[11,22],[13,24]]);
    expect(math.multiply([[1,2],[3,4]],0.5)).toEqual([[0.5,1],[1.5,2]]);
    expect(math.cross([1,0,0],[0,1,0])).toEqual([0,0,1]);
    expect(() => math.cross([1,2],[2,3])).toThrow('3D');
  });
  it('keeps softmax numerically stable and causal attention masked', () => {
    const result = math.softmax([1000,1001,1002]);
    expect(result.reduce((a: number,b: number)=>a+b,0)).toBeCloseTo(1);
    expect(result.every(Number.isFinite)).toBe(true);
    const output = math.attention([[1,0],[0,1]],[[1,0],[0,1]],[[10,20],[30,40]],true);
    expect(output[0]).toEqual([10,20]);
    expect(output[1][0]).toBeGreaterThan(10);
    const normalized = math.layerNorm([[1,2,3],[3,4,5]]);
    expect(normalized[0].reduce((a:number,b:number)=>a+b,0)).toBeCloseTo(0);
  });
  it('executes every operator default through its editable code and LaTeX render body', async () => {
    for (const [name, recipe] of Object.entries(jsRecipes).filter(([,r])=>r.category==='Operators')) {
      const node = makeJsNode(name,{x:0,y:0});
      const code = buildBlockModule(node.data.module!, node.data.render!);
      const module = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
      const outputs: unknown[] = [], equations: string[] = [];
      const mounted = await module.default({ inputs:{}, state:{}, value:recipe.value, element:{}, modules:{math}, emit:(value:unknown)=>outputs.push(value), ui:{ latex:(_element: unknown,tex: string)=>{equations.push(katex.renderToString(tex,{throwOnError:true,output:'mathml'}));} } });
      expect(outputs.length, name).toBe(1);
      expect(equations[0], name).toContain('<math');
      await mounted.destroy();
    }
  });
});

describe('My Blocks project persistence', () => {
  it('round trips code, ports, rendering, state and embedded dependencies', () => {
    const d=exampleDiagram(), node=makeJsNode('MatMul',{x:0,y:0});
    d.myBlocks=[{id:'saved-matmul',name:'My projection',width:280,height:200,data:node.data,modules:[mathLibrary]}];
    expect(parseDiagram(serializeDiagram(d))).toEqual(d);
  });
  it('rejects duplicate saved IDs and malformed saved render bodies', () => {
    const d=exampleDiagram(),node=makeJsNode('DOM',{x:0,y:0});
    d.myBlocks=[{id:'saved',name:'Saved',width:240,height:190,data:node.data}];
    d.myBlocks.push(d.myBlocks[0]);
    expect(()=>parseDiagram(serializeDiagram(d))).toThrow('saved');
    d.myBlocks.pop();
    (d.myBlocks[0].data as any).render=42;
    expect(()=>parseDiagram(serializeDiagram(d))).toThrow('render');
  });
});

import forwardExample from '../examples/transformer-forward.json?raw';
it('executes the complete transformer example using its wired numeric outputs', async () => {
  const diagram=parseDiagram(forwardExample),outputs:Record<string,unknown>={};
  for(const node of diagram.nodes) {
    const inputs:Record<string,unknown>={};
    for(const port of node.data.ports.filter(p=>p.type==='input')) {
      const edge=diagram.edges.find(e=>e.target===node.id&&e.targetHandle===port.id);
      inputs[port.id]=edge?outputs[edge.source]:null;
      if(port.variable)inputs[port.variable]=inputs[port.id];
    }
    const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
    const state:Record<string,unknown>={};
    const mounted=await module.default({inputs,state,element:{},value:node.data.value,modules:{math},emit:(value:unknown)=>{outputs[node.id]=value;},ui:{latex:()=>{}}});
    if(node.id==='output') {
      expect(math.shape(state.result)).toEqual([2,2]);
      expect((state.result as number[][]).flat().every(Number.isFinite)).toBe(true);
      expect((state.result as number[][])[0].reduce((a,b)=>a+b,0)).toBeCloseTo(0);
    }
    await mounted.destroy();
  }
});
