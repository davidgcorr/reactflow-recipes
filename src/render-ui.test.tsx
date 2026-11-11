// @vitest-environment jsdom
import * as math from './math-library.js';
await math.ready;
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as ui from './sandbox-ui';
import { buildBlockModule } from './block-code';
import { makeJsNode } from './js-recipes';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { document.body.replaceChildren(); });
async function mount(name: string) {
  const node=makeJsNode(name,{x:0,y:0}),element=document.createElement('div');document.body.append(element);
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
  const outputs: unknown[]=[],updates: Promise<unknown>[]=[];let current:any;
  await act(async()=> { current=await module.default({element,state:{},inputs:{},modules:{math,tensorMath:math},value:node.data.value,ports:node.data.ports,ui,emit:(value:unknown)=>outputs.push(value),setValue:(value:string)=>updates.push(current.update({},value))}); });
  return {element,outputs,settle:()=>Promise.all(updates),dispose:()=>act(async()=>current.destroy())};
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
it('uses the single math/value viewer for nested outputs and earlier runtime previews',async()=>{
  const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
  for(const value of [math.matmul([[1,2],[3,4]],[[5],[6]]),{$ref:'matrix',type:'Matrix',shape:[2,1],rows:[[17],[39]],slices:1,slice:0}]){
    await act(async()=>root.render(createElement(PreviewContext.Provider,{value:{values:{viewer:{inputs:{'in-0':value as any},outputs:{}}},emit(){},setValue(){},saveState(){},setProperty(){},report(){}}},createElement(ValueRenderer,{id:'viewer',settings:{precision:4,slice:0,fontSize:32}}))));
    expect(element.querySelector('.value-formula math')).not.toBeNull();
    expect(element.textContent).toContain('17');expect(element.textContent).toContain('39');
    expect((element.querySelector('.value-formula') as HTMLElement).style.fontSize).toBe('32px');
    expect(element.querySelector('.value-table-scroll')).toBeNull();
  }
  await act(async()=>root.unmount());
});
