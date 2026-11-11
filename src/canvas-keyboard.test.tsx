// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import App from './App';
import { exampleDiagram,makeNode,serializeDiagram } from './model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('copies and pastes selected canvas blocks through actual Ctrl+C / Ctrl+V events',async()=>{
  vi.stubGlobal('DOMMatrixReadOnly',class{m22=1;});
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  const project={...exampleDiagram(),modules:[],nodes:[makeNode('constant',{x:0,y:0},'copy-me')],edges:[]};
  localStorage.setItem('milver.diagram.v1',serializeDiagram(project));
  let copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn(async(text:string)=>{copied=text;}),readText:vi.fn(async()=>copied)}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  await act(async()=>root.render(createElement(App)));
  const node=host.querySelector('.react-flow__node')!;
  await act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await act(async()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true})));
  expect(copied).toContain('milver.blocks');
  await act(async()=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true})));
  expect(host.querySelectorAll('.react-flow__node')).toHaveLength(2);
  await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});
  await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();
});
