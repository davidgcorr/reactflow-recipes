// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it, vi } from 'vitest';
import CodeMirrorField from './components/codemirror-field';
import { ResizablePanel } from './components/resizable-panel';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('highlights JavaScript and sends actual editor changes to the controlled value',async()=>{
  const element=document.createElement('div');document.body.append(element);
  const root=createRoot(element),onChange=vi.fn();
  await act(async()=>root.render(createElement(CodeMirrorField,{value:'const answer = 42;',onChange,label:'Test JavaScript',language:'javascript'})));
  const content=element.querySelector('.cm-content');
  expect(content?.getAttribute('aria-label')).toBe('Test JavaScript');
  expect(content?.querySelectorAll('span').length).toBeGreaterThan(0);
  const editor=EditorView.findFromDOM(element.querySelector('.cm-editor') as HTMLElement)!;
  editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:'emit(42);'}});
  expect(onChange).toHaveBeenCalledWith('emit(42);');
  await act(async()=>root.unmount());element.remove();
});
it('resizes the inspector with the keyboard and persists its width',async()=>{
  localStorage.removeItem('milver.inspector.width');
  const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
  await act(async()=>root.render(createElement(ResizablePanel,{children:'Inspector'})));
  const separator=element.querySelector('[role="separator"]')!;
  expect(separator.getAttribute('aria-valuenow')).toBe('360');
  await act(async()=>separator.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
  expect(separator.getAttribute('aria-valuenow')).toBe('384');
  expect(localStorage.getItem('milver.inspector.width')).toBe('384');
  await act(async()=>root.unmount());element.remove();
});
