import { makeNode, type BlockNode } from './model';
import { moduleRecipes } from './module-recipes';

const datatype = (type: string) => `export default function mount({ element, value, emit }) {
  function update(inputs, value) {
    const result = ${type === 'string' ? 'value' : 'JSON.parse(value)'};
    ${type === 'number' ? "if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('Enter a finite JSON number.');" : type === 'boolean' ? "if (typeof result !== 'boolean') throw new Error('Enter true or false.');" : type === 'vector' ? "if (!Array.isArray(result) || !result.every(Number.isFinite)) throw new Error('Enter a numeric JSON vector.');" : type === 'matrix' ? "if (!Array.isArray(result) || !result.length || !result.every(row => Array.isArray(row) && row.length === result[0].length && row.every(Number.isFinite))) throw new Error('Enter a rectangular numeric JSON matrix.');" : type === 'tensor' ? "if (!result || !Array.isArray(result.shape) || !result.shape.length || !result.shape.every(n => Number.isInteger(n) && n > 0) || !Array.isArray(result.data) || !result.data.every(Number.isFinite) || result.shape.reduce((a,b) => a*b, 1) !== result.data.length) throw new Error('Enter {shape: [...], data: [...]} with matching numeric data.');" : ''}
    element.textContent = typeof result === 'object' ? JSON.stringify(result) : String(result);
    element.style.cssText = 'font:14px system-ui;padding:12px;word-break:break-word;box-sizing:border-box';
    emit(result);
  }
  update({}, value); return { update };
}`;
const slider = `export default function mount({ element, value, emit, setValue }) {
  const wrapper=document.createElement('label'), control=document.createElement('input'), output=document.createElement('output');
  control.type='range'; control.setAttribute('aria-label','Source slider');
  wrapper.style.cssText='display:grid;gap:12px;width:80%'; wrapper.append(control,output); element.append(wrapper);
  let config;
  function publish(){output.textContent=control.value;emit(Number(control.value));}
  control.oninput=()=>{publish();setValue(JSON.stringify({...config,initial:Number(control.value)}));};
  function update(inputs,value){config=JSON.parse(value);if(!Number.isFinite(config.min)||!Number.isFinite(config.max)||config.max<=config.min||!Number.isFinite(config.step)||config.step<=0)throw new Error('Slider needs min < max and a positive step.');control.min=config.min;control.max=config.max;control.step=config.step;control.value=config.initial;publish();}
  update({},value);return {update};
}`;
const selector = `export default function mount({ element, value, emit, setValue }) {
  const control=document.createElement('select');control.setAttribute('aria-label','Source selector');control.style.cssText='max-width:90%;padding:8px';element.append(control);let config;
  function publish(){emit(config.options[control.selectedIndex] ?? null);}
  control.onchange=()=>{publish();setValue(JSON.stringify({...config,selected:control.selectedIndex}));};
  function update(inputs,value){config=JSON.parse(value);if(!Array.isArray(config.options)||!config.options.length||config.options.some(v=>!['string','number','boolean'].includes(typeof v)))throw new Error('Provide nonempty scalar options.');control.replaceChildren(...config.options.map(v=>{const o=document.createElement('option');o.textContent=String(v);return o;}));control.selectedIndex=Math.max(0,Math.min(config.options.length-1,config.selected??0));publish();}
  update({},value);return {update};
}`;
const button = `export default function mount({ element, value, emit, setValue }) {
  const button=document.createElement('button');button.style.cssText='padding:10px 18px;cursor:pointer';element.append(button);let config;
  button.onclick=()=>{config.count=(config.count??0)+1;emit(config.count);setValue(JSON.stringify(config));button.textContent=config.label+' · '+config.count;};
  function update(inputs,value){config=JSON.parse(value);button.textContent=(config.label??'Click')+' · '+(config.count??0);emit(config.count??0);}
  update({},value);return {update};
}`;
const clock = `export default function mount({ element, value, emit }) {
  let timer,period,count=0;
  function update(inputs,value){const next=Number(value);if(!Number.isFinite(next)||next<16||next>3600000)throw new Error('Clock period must be 16–3600000 ms.');if(next===period)return;clearInterval(timer);period=next;timer=setInterval(()=>{count++;element.textContent=String(count);emit(count);},period);element.textContent=String(count);emit(count);}
  update({},value);return {update,destroy(){clearInterval(timer);}};
}`;
const trigger = `export default function mount({ element, inputs, emit }) {
  let previous=false,count=0;
  function update(inputs){const active=Boolean(inputs['in-0']);if(active&&!previous)count++;previous=active;element.textContent='↑ '+count;emit(count);}
  update(inputs);return {update};
}`;
export const wasmSource = `export default async function mount({ element, inputs, emit, wasm, ports }) {
  if(!wasm)throw new Error('Import a .wasm module in the Code tab.');
  const bytes=Uint8Array.from(atob(wasm.base64),c=>c.charCodeAt(0));
  const {instance}=await WebAssembly.instantiate(bytes, {});
  const fn=instance.exports[wasm.exportName];
  if(typeof fn!=='function')throw new Error('Choose an exported WebAssembly function.');
  function update(inputs){const args=ports.filter(p=>p.type==='input').map(p=>inputs[p.id]);if(args.some(x=>typeof x!=='number'||!Number.isFinite(x))){element.textContent='Connect numeric inputs';emit(null);return;}const result=fn(...args);element.textContent=String(result);emit(typeof result==='bigint'?Number(result):result);}
  update(inputs);return {update};
}`;
// A working two-i32 add module; imported binaries replace this in JSON.
export const exampleWasm = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';
export const jsRecipes = {
  ...Object.fromEntries(Object.entries(moduleRecipes).map(([label, source]) => [label, { label: `${label} module`, symbol: label === 'DOM' ? 'JS' : label === 'LaTeX' ? 'ƒ' : '3D', category: 'JavaScript code blocks', source, value: '1', inputs: 1, outputs: 1 }])),
  Number: { label: 'Number', symbol: '123', category: 'JavaScript datatypes', source: datatype('number'), value: '1', inputs: 0, outputs: 1 },
  Boolean: { label: 'Boolean', symbol: 'T/F', category: 'JavaScript datatypes', source: datatype('boolean'), value: 'true', inputs: 0, outputs: 1 },
  String: { label: 'String', symbol: 'abc', category: 'JavaScript datatypes', source: datatype('string'), value: 'Hello', inputs: 0, outputs: 1 },
  Vector: { label: 'Vector', symbol: '[x]', category: 'JavaScript datatypes', source: datatype('vector'), value: '[1,2,3]', inputs: 0, outputs: 1 },
  Matrix: { label: 'Matrix', symbol: '▦', category: 'JavaScript datatypes', source: datatype('matrix'), value: '[[1,2],[3,4]]', inputs: 0, outputs: 1 },
  Tensor: { label: 'Tensor', symbol: '▧', category: 'JavaScript datatypes', source: datatype('tensor'), value: '{"shape":[2,2,2],"data":[1,2,3,4,5,6,7,8]}', inputs: 0, outputs: 1 },
  Clock: { label: 'Clock', symbol: '◷', category: 'JavaScript sources', source: clock, value: '1000', inputs: 0, outputs: 1 },
  Trigger: { label: 'Trigger', symbol: '↑', category: 'JavaScript sources', source: trigger, value: '', inputs: 1, outputs: 1 },
  Slider: { label: 'Slider', symbol: '☷', category: 'JavaScript sources', source: slider, value: '{"min":0,"max":100,"step":1,"initial":50}', inputs: 0, outputs: 1 },
  Selector: { label: 'Selector', symbol: '▾', category: 'JavaScript sources', source: selector, value: '{"options":["A","B","C"],"selected":0}', inputs: 0, outputs: 1 },
  Button: { label: 'Button', symbol: '↖', category: 'JavaScript sources', source: button, value: '{"label":"Click","count":0}', inputs: 0, outputs: 1 },
  WebAssembly: { label: 'WebAssembly', symbol: 'WA', category: 'JavaScript code blocks', source: wasmSource, value: '', inputs: 2, outputs: 1 },
} satisfies Record<string, { label: string; symbol: string; category: string; source: string; value: string; inputs: number; outputs: number }>;
export function applyJsRecipe(node: BlockNode, name: string): BlockNode {
  const recipe = jsRecipes[name as keyof typeof jsRecipes];
  if (!recipe) throw new Error('Unknown JavaScript recipe.');
  const ports = [
    ...Array.from({ length: recipe.inputs }, (_, i) => ({ id: `in-${i}`, name: `in ${i + 1}`, type: 'input' as const, side: 'left' as const, variable: `input${i + 1}` })),
    ...Array.from({ length: recipe.outputs }, (_, i) => ({ id: `out-${i}`, name: 'out', type: 'output' as const, side: 'right' as const, variable: `output${i + 1}` })),
  ];
  return { ...node, data: { ...node.data, kind: 'javascript', recipe: name, label: recipe.label, module: recipe.source, value: recipe.value, ports, ...(name === 'WebAssembly' ? { wasm: { filename: 'add.wasm', base64: exampleWasm, exportName: 'add' } } : {}) } };
}
export function makeJsNode(name: string, position: { x: number; y: number }, id?: string) { return applyJsRecipe(makeNode('javascript', position, id), name); }
