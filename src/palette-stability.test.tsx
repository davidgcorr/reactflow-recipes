// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import App from './App';
import { defaultTheme,serializeDiagram } from './model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('inserts every palette block with rough mode enabled without crashing the editor',async()=>{
  vi.stubGlobal('DOMMatrixReadOnly',class{m22=1;});
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  localStorage.setItem('milver.diagram.v1',serializeDiagram({version:1,name:'Palette',theme:{...defaultTheme,rough:true},nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(createElement(App)));
    const buttons=[...host.querySelectorAll<HTMLButtonElement>('#library-panel-blocks .palette-tile')];
    expect(buttons.length).toBeGreaterThan(10);
    for(const button of buttons){
      await act(async()=>button.click());
      expect(host.querySelector('main'),button.textContent??'').not.toBeNull();
    }
    expect(host.querySelectorAll('.react-flow__node')).toHaveLength(buttons.length);
    await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});
  } finally {await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();}
});
