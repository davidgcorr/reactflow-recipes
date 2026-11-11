// @vitest-environment jsdom
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
  await act(async()=> { current=await module.default({element,state:{},inputs:{},modules:{},value:node.data.value,ports:node.data.ports,ui,emit:(value:unknown)=>outputs.push(value),setValue:(value:string)=>updates.push(current.update({},value))}); });
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
