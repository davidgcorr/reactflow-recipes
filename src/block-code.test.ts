import { expect, it } from 'vitest';
import { buildBlockModule, completeFunction, insertFunctionSnippet } from './block-code';
import { makeJsNode } from './js-recipes';
it('stores full editable functions and runs them with shared state and render lifecycle',async()=>{
  const node=makeJsNode('DOM',{x:0,y:0});
  expect(node.data.module).toMatch(/^async function run\(/);
  expect(node.data.render).toMatch(/^async function render\(/);
  const source=buildBlockModule(`async function run() { state.result = inputs.input1 * 2; emit(state.result); await render(); }`, `async function render() { element.textContent = 'Value: ' + state.result; }`);
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const element={textContent:''},outputs:number[]=[];
  const mounted=await module.default({element,state:{},inputs:{input1:3},emit:(x:number)=>outputs.push(x)});
  expect(element.textContent).toBe('Value: 6');
  await mounted.update({input1:5},'');
  expect(element.textContent).toBe('Value: 10');expect(outputs).toEqual([6,10]);
  await mounted.destroy();
});
it('keeps earlier body-only projects working and inserts snippets inside the function',()=>{
  const wrapped=completeFunction('emit(1);','run');
  expect(completeFunction(wrapped,'run')).toBe(wrapped);
  expect(insertFunctionSnippet(wrapped,'await render();')).toMatch(/await render\(\);\s*}$/);
  expect(()=>buildBlockModule('emit(1);','element.textContent="OK";')).not.toThrow();
});
