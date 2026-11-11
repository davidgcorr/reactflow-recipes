// @vitest-environment jsdom
import { act, createElement, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { Block } from './components/block-node';
import { ModuleMask, loadRenderBundle } from './components/module-mask';
import { makeJsNode } from './js-recipes';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeAll(()=>vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}unobserve(){}}));

it('loads the render bundle for freshly inserted blocks and sends inputs to the new iframe',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('Button',{x:0,y:0},'button');
  const props={id:node.id,source:node.data.module,render:node.data.render,ports:node.data.ports,value:node.data.value,color:'#171717',background:'#ffffff'};
  await act(async()=>root.render(createElement(ModuleMask,props)));
  await act(async()=>{await loadRenderBundle();});
  let frame=host.querySelector('iframe')!;
  expect(frame.srcdoc).not.toContain('Loading renderer…');
  expect(frame.srcdoc).toContain('uiSource');
  const first=frame;
  // Simulate dropping another fresh block, without reloading the page.
  await act(async()=>root.render(createElement(ModuleMask,{...props,key:'new',id:'new-button'})));
  await act(async()=>{await loadRenderBundle();});
  frame=host.querySelector('iframe')!;
  expect(frame).not.toBe(first);
  expect(frame.srcdoc).not.toContain('Loading renderer…');
  const config=JSON.parse(frame.srcdoc.split('config=')[1].split(';\nconst validSignal')[0]);
  const send=vi.spyOn(frame.contentWindow!,'postMessage');
  await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'mask-ready',token:config.token}})));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'mask-input',value:node.data.value}), '*');
  await act(async()=>root.unmount());host.remove();
});

it('enables block controls only on double click and disables them on outside click',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('DOM',{x:0,y:0},'editable');
  await act(async()=>root.render(createElement(ReactFlowProvider,null,createElement(Block,{id:node.id,data:node.data,selected:true,type:'block',dragging:false,zIndex:0,isConnectable:true,positionAbsoluteX:0,positionAbsoluteY:0,selectable:true,deletable:true,draggable:true} as any))));
  const card=host.querySelector('.diagram-block')!;
  expect(host.querySelector('.mask-interaction-toggle')).toBeNull();
  await act(async()=>card.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(false);
  await act(async()=>card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(true);
  await act(async()=>document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(false);
  await act(async()=>root.unmount());host.remove();
});

it('keeps a math block iframe mounted through saved-state and value updates',async()=>{
  const { ProjectContext }=await import('./project/context');
  const { mathLibrary }=await import('./default-libraries');
  const { loadMathBundle }=await import('./components/module-mask');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('Matrix',{x:0,y:0},'matrix');
  const props={id:node.id,source:node.data.module,render:node.data.render,ports:node.data.ports,value:node.data.value,color:'#171717',background:'#ffffff'};
  function View(extra: Record<string,unknown>) {
    const context=useContext(ProjectContext);
    return createElement(ProjectContext.Provider,{value:{...context,modules:[mathLibrary]}},createElement(ModuleMask,{...props,...extra}));
  }
  const view=(extra:Record<string,unknown>={})=>createElement(View,extra);
  try {
    await act(async()=>root.render(view()));
    await act(async()=>{await Promise.all([loadRenderBundle(),loadMathBundle()]);});
    const frame=host.querySelector('iframe')!;
    expect(frame.srcdoc).not.toContain('Loading renderer…');
    const config=JSON.parse(frame.srcdoc.split('config=')[1].split(';\nconst validSignal')[0]);
    expect(config.dependencies[0].source.length).toBeGreaterThan(100000);
    await act(async()=>root.render(view({state:{result:[[2,3],[4,5]]},value:'[[2,3],[4,5]]'})));
    expect(host.querySelector('iframe')).toBe(frame);
  } finally {await act(async()=>root.unmount());host.remove();}
});
