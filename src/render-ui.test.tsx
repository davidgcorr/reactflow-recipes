// @vitest-environment jsdom
import * as math from './math-library.js';
await math.ready;
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as ui from './sandbox-ui';
import { buildBlockModule } from './block-code';
import { makeNode } from './model';
import { makeJsNode } from './js-recipes';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { document.body.replaceChildren(); });
async function mount(name: string, fontSize?: number) {
  const node=name==='Viewer'?makeNode('renderer',{x:0,y:0}):makeJsNode(name,{x:0,y:0});const element=document.createElement('div');document.body.append(element);
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
  const outputs: unknown[]=[],updates: Promise<unknown>[]=[];let current:any;
  await act(async()=> { current=await module.default({element,state:{},inputs:{},modules:{math,tensorMath:math},value:node.data.value,ports:node.data.ports,renderer:{...node.data.renderer,fontSize},ui,emit:(value:unknown)=>outputs.push(value),setValue:(value:string)=>updates.push(current.update({},value))}); });
  return {element,outputs,update:(input:unknown)=>act(async()=>current.update({'in-0':input},node.data.value)),settle:()=>Promise.all(updates),dispose:()=>act(async()=>current.destroy())};
}
describe('React / shadcn source rendering in a real DOM',()=>{
  it('renders the shared Button component and persists click output through Code',async()=>{
    const run=await mount('Button');
    const button=run.element.querySelector('[data-slot="button"]') as HTMLButtonElement;
    expect(button.textContent).toContain('Click');
    await act(async()=>{button.click();await run.settle();});
    expect(run.outputs).toEqual([0,1]);
    expect(button.textContent).toContain('1');
    await run.dispose();
  });
  it('renders an accessible Radix slider and processes keyboard input',async()=>{
    const run=await mount('Slider');
    const slider=run.element.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
    await act(async()=>{slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await run.settle();});
    expect(run.outputs.at(-1)).toBe(51);
    expect(slider.getAttribute('aria-valuenow')).toBe('51');
    await run.dispose();
  });
  it('renders a shadcn Select trigger with its current option',async()=>{
    const run=await mount('Selector');
    expect(run.element.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe('Source selector');
    expect(run.element.textContent).toContain('A');
    expect(run.outputs).toEqual(['A']);
    await run.dispose();
  });
  it('renders matrices and tensors as actual accessible mathematical tables',async()=>{
    for(const name of ['Matrix','Tensor']) {
      const run=await mount(name);
      expect(run.element.querySelector('math')).not.toBeNull();
      expect(run.element.querySelector('mtable')).not.toBeNull();
      expect(run.element.textContent).not.toContain('KaTeX parse error');
      await run.dispose();
    }
  });
});

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ValueRenderer } from './components/value-renderer';
import { PreviewContext } from './components/module-mask';
it('renders both nested outputs and earlier runtime previews through the editable viewer function',async()=>{
  const run=await mount('Viewer',32);
  for(const value of [math.matmul([[1,2],[3,4]],[[5],[6]]),{$ref:'matrix',type:'Matrix',shape:[2,1],rows:[[17],[39]],slices:1,slice:0}]){
    await run.update(value);
    expect(run.element.querySelector('math')).not.toBeNull();
    expect(run.element.textContent).toContain('17');expect(run.element.textContent).toContain('39');
    expect((run.element.querySelector('.math-content') as HTMLElement).style.fontSize).toBe('32px');
    expect(run.element.querySelector('.value-table-scroll')).toBeNull();
  }
  await run.dispose();
});
it('renders infinity and applies an edited viewer function',async()=>{
  const run=await mount('Viewer',30);
  await run.update([[2,-Infinity,0],[0,2,0],[0,0,1]]);
  expect(run.element.querySelector('math')).not.toBeNull();
  expect(run.element.textContent).toContain('∞');
  expect(run.element.textContent).not.toContain('null');
  await run.dispose();
  const node=makeNode('renderer',{x:0,y:0});
  node.data.render=`async function render(){ element.textContent = 'Custom: ' + state.result[0][0]; element.style.color = 'red'; }`;
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render)).toString('base64')}`);
  const element=document.createElement('div');document.body.append(element);
  const current=await module.default({element,state:{},inputs:{'in-0':[[42]]},ui});
  expect(element.textContent).toBe('Custom: 42');expect(element.style.color).toBe('red');
  await current.destroy();
});
