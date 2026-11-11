import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
export { tf };
// Browser-standard services also work in the isolated project worker.
tf.setPlatform('milver', {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => performance.now(),
  encode: text => new TextEncoder().encode(text),
  decode: bytes => new TextDecoder().decode(bytes),
  isTypedArray: value => value instanceof Float32Array || value instanceof Int32Array || value instanceof Uint8Array || value instanceof Uint8ClampedArray,
});
export const ready = tf.setBackend('cpu').then(() => tf.ready());
// Connections carry nested numeric arrays. Tensors are temporary and always disposed.
function nested(value) {
  if (value instanceof tf.Tensor) return value.arraySync();
  if (value && !Array.isArray(value) && Array.isArray(value.shape) && Array.isArray(value.data)) {
    if (!value.shape.length || !value.shape.every(n => Number.isInteger(n) && n > 0) || value.shape.reduce((a,b)=>a*b,1) !== value.data.length) throw new Error('Tensor shape must match its data.');
    return tf.tidy(() => tf.tensor(value.data,value.shape,'float32').arraySync());
  }
  return value;
}
function dimensions(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return [];
  if (!Array.isArray(value) || !value.length) throw new Error('Expected nonempty finite numeric data.');
  const inner=dimensions(value[0]);
  if (!value.every(row=>JSON.stringify(dimensions(row))===JSON.stringify(inner))) throw new Error('Arrays must be rectangular.');
  return [value.length,...inner];
}
export function shape(value) { return dimensions(nested(value)); }
export function tensor(value) { value=nested(value); dimensions(value); return tf.tensor(value,undefined,'float32'); }
export function normalize(value) { value=nested(value); dimensions(value); return tf.tidy(()=>tensor(value).arraySync()); }
export function parse(value) {
  if (typeof value !== 'string') return normalize(value);
  try { return normalize(JSON.parse(value.replace(/,\s*([\]])/g,'$1'))); }
  catch(error) { throw new Error('Enter a finite number or rectangular nested list, e.g. [1,2,3] or [[1,2],[3,4]]. ' + error.message); }
}
function calculate(operation) { return tf.tidy(()=>operation().arraySync()); }
export const add=(a,b)=>calculate(()=>tf.add(tensor(a),tensor(b)));
export const multiply=(a,b)=>calculate(()=>tf.mul(tensor(a),tensor(b)));
export function matmul(a,b) {
  const sa=shape(a),sb=shape(b);
  if(!sa.length||!sb.length||sa.at(-1)!==(sb.length===1?sb[0]:sb.at(-2)))throw new Error('Matrix inner dimensions must match.');
  return calculate(()=>{
    let x=tensor(a),y=tensor(b);
    if(sa.length===1)x=tf.expandDims(x,0);
    if(sb.length===1)y=tf.expandDims(y,-1);
    let result=tf.matMul(x,y);
    if(sa.length===1)result=tf.squeeze(result,[-2]);
    if(sb.length===1)result=tf.squeeze(result,[-1]);
    return result;
  });
}
export function transpose(a,permutation) { const rank=shape(a).length;const perm=permutation??(rank<2?undefined:[...Array(rank-2).keys(),rank-1,rank-2]);return calculate(()=>tf.transpose(tensor(a),perm)); }
export function reshape(a,dims) { shape(a);if(!Array.isArray(dims)||!dims.length||!dims.every(n=>Number.isInteger(n)&&n>0))throw new Error('Reshape dimensions must be positive integers.');return calculate(()=>tf.reshape(tensor(a),dims)); }
export function dot(a,b) { const sa=shape(a),sb=shape(b);if(sa.length!==1||sb.length!==1||sa[0]!==sb[0])throw new Error('Dot product needs equal-length vectors.');return calculate(()=>tf.sum(tf.mul(tensor(a),tensor(b)))); }
export function cross(a,b) { if(shape(a).join()!=='3'||shape(b).join()!=='3')throw new Error('Cross product needs two 3D vectors.');return calculate(()=>{const x=tensor(a),y=tensor(b);const left=tf.mul(tf.gather(x,[1,2,0]),tf.gather(y,[2,0,1]));return tf.sub(left,tf.mul(tf.gather(x,[2,0,1]),tf.gather(y,[1,2,0])));}); }
export const softmax=a=>calculate(()=>tf.softmax(tensor(a),-1));
export const gelu=a=>calculate(()=>{const x=tensor(a);return tf.mul(tf.mul(x,0.5),tf.add(tf.tanh(tf.mul(tf.add(x,tf.mul(tf.pow(x,3),0.044715)),Math.sqrt(2/Math.PI))),1));});
export function layerNorm(a,epsilon=1e-5) { if(!Number.isFinite(epsilon)||epsilon<=0)throw new Error('epsilon must be positive.');return calculate(()=>{const x=tensor(a);const {mean,variance}=tf.moments(x,[-1],true);return tf.div(tf.sub(x,mean),tf.sqrt(tf.add(variance,epsilon)));}); }
export function attention(q,k,v,causal=false) {
  const qs=shape(q),ks=shape(k),vs=shape(v);
  if(qs.length<2||ks.length<2||vs.length<2||qs.at(-1)!==ks.at(-1)||ks.at(-2)!==vs.at(-2))throw new Error('Attention requires matching Q/K widths and K/V sequence lengths.');
  return calculate(()=>{
    let scores=tf.div(tf.matMul(tensor(q),tensor(k),false,true),Math.sqrt(qs.at(-1)));
    if(causal){const rows=qs.at(-2),cols=ks.at(-2);const mask=tf.tensor2d(Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>j>i?-1e9:0)));scores=tf.add(scores,mask);}
    return tf.matMul(tf.softmax(scores,-1),tensor(v));
  });
}
export function tensorContract(a,b) {
  const sa=shape(a),sb=shape(b);if(!sa.length||!sb.length||sa.at(-1)!==sb[0])throw new Error('Last/first tensor dimensions must match.');
  const dims=[...sa.slice(0,-1),...sb.slice(1)];
  return calculate(()=>tf.reshape(tf.matMul(tf.reshape(tensor(a),[-1,sa.at(-1)]),tf.reshape(tensor(b),[sb[0],-1])),dims));
}
