// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, expect, it, vi } from 'vitest';
import * as ui from './sandbox-ui';
import { sandbox } from './test-utils/module-sandbox';
import { makeNode } from './model';
import { makeJsNode } from './js-recipes';
import { buildBlockModule } from './block-code';
import mathSource from './generated/block-math.js?raw';
import { PreviewContext } from './components/module-mask';
import { ValueRenderer } from './components/value-renderer';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
it('transfers the screenshot matrices through source → transpose / matmul → math viewers', async () => {
  const mount = async (recipe: string, value?: string) => {
    const node = recipe === 'Viewer' ? makeNode('renderer', { x: 0, y: 0 }) : makeJsNode(recipe, { x: 0, y: 0 });
    const element = document.createElement('div'); document.body.append(element);
    const run = await sandbox(buildBlockModule(node.data.module!, node.data.render!), [{ specifier: 'math', source: mathSource }], {}, { ports: node.data.ports, element, ui });
    return { ...run, element, value: value ?? node.data.value };
  };
  const a = await mount('Matrix', '[[1,1],[0,10]]');
  const b = await mount('Matrix', '[[1],[0]]');
  const transpose = await mount('Transpose'), matmul = await mount('MatMul');
  const output = (run: Awaited<ReturnType<typeof mount>>) => run.messages.filter(m => m.type === 'mask-output').at(-1)?.value;
  const transposeView=await mount('Viewer'),productView=await mount('Viewer');
  try {
    for (const [matrix, column] of [
      [[[1,1],[0,10]], [[1],[0]]],
      [[[2,3],[4,5]], [[6],[7]]],
    ]) {
      await a.send(JSON.stringify(matrix), {}); await b.send(JSON.stringify(column), {});
      await transpose.send(transpose.value, { 'in-0': output(a) });
      await matmul.send(matmul.value, { 'in-0': output(a), 'in-1': output(b) });
      const expectedTranspose = matrix[0].map((_, j) => matrix.map(row => row[j]));
      const expectedProduct = matrix.map(row => [row.reduce((sum, x, i) => sum + x * column[i][0], 0)]);
      expect(output(transpose)).toEqual(expectedTranspose); expect(output(matmul)).toEqual(expectedProduct);
      for (const run of [a,b,transpose,matmul]) {
        expect(run.messages.filter(m => m.type === 'mask-error')).toEqual([]);
        expect(run.element.querySelector('math')).not.toBeNull();
      }
      await transposeView.send('', {'in-0':output(transpose)});
      await productView.send('', {'in-0':output(matmul)});
      for(const view of [transposeView,productView]) {
        expect(view.messages.filter(m=>m.type==='mask-error')).toEqual([]);
        expect(view.element.querySelector('math')).not.toBeNull();
        expect(view.element.textContent).not.toContain('Connect an input');
      }
      expect(productView.element.textContent).toContain(String(expectedProduct[1][0]));
    }
  } finally {
    for (const run of [a,b,transpose,matmul,transposeView,productView]) run.dispose();
    document.body.replaceChildren();
  }
});
it('transfers infinity-valued matrices through the source, transpose and editable viewer',async()=>{
  const start=makeJsNode('Matrix',{x:0,y:0}),transpose=makeJsNode('Transpose',{x:0,y:0}),viewer=makeNode('renderer',{x:0,y:0});
  const mount=async(node:typeof start)=>{
    const element=document.createElement('div');document.body.append(element);
    const run=await sandbox(buildBlockModule(node.data.module!,node.data.render!),[{specifier:'math',source:mathSource}],{}, {ports:node.data.ports,element,ui});return {...run,element};
  };
  const a=await mount(start),b=await mount(transpose),c=await mount(viewer);
  try{
    await a.send('[[2,-inf,0],[0,2,0],[0,0,1]]',{});
    const input=a.messages.filter(m=>m.type==='mask-output').at(-1).value;
    await b.send(transpose.data.value,{'in-0':input});
    const output=b.messages.filter(m=>m.type==='mask-output').at(-1).value;
    expect(output).toEqual([[2,0,0],[-Infinity,2,0],[0,0,1]]);
    await c.send('',{'in-0':output});
    expect(c.element.textContent).toContain('∞');expect(c.element.querySelector('math')).not.toBeNull();
    for(const run of [a,b,c])expect(run.messages.filter(m=>m.type==='mask-error')).toEqual([]);
  }finally{for(const run of [a,b,c])run.dispose();document.body.replaceChildren();}
});
