// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { RenderBoundary } from './components/render-boundary';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('contains a broken view and recovers when its code changes, preserving its siblings',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  function Broken({fail}:{fail:boolean}) {if(fail)throw new Error('Invalid block render');return createElement('span',null,'Working block');}
  const view=(fail:boolean,key:string)=>createElement('main',null,createElement('span',null,'Other blocks'),createElement(RenderBoundary,{resetKey:key},createElement(Broken,{fail})));
  try {
    await act(async()=>root.render(view(true,'original')));
    expect(host.textContent).toContain('Other blocks');expect(host.querySelector('[role=alert]')?.textContent).toContain('Invalid block render');
    await act(async()=>root.render(view(false,'edited')));
    expect(host.querySelector('[role=alert]')).toBeNull();expect(host.textContent).toContain('Working block');
  }finally{await act(async()=>root.unmount());host.remove();log.mockRestore();}
});
