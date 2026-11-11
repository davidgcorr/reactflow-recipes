// Small, dependency-free numeric kernels for editable forward-model blocks.
const numeric = x => { if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('Expected finite numeric data.'); return x; };
export function shape(x) {
  if (typeof x === 'number') { numeric(x); return []; }
  if (x && !Array.isArray(x) && Array.isArray(x.shape) && Array.isArray(x.data)) {
    if (!x.shape.length || !x.shape.every(n => Number.isInteger(n) && n > 0) || x.shape.reduce((a,b) => a*b,1) !== x.data.length) throw new Error('Tensor shape does not match data.');
    x.data.forEach(numeric); return [...x.shape];
  }
  if (!Array.isArray(x) || !x.length) throw new Error('Expected a nonempty numeric array.');
  const child = shape(x[0]);
  if (!x.every(row => JSON.stringify(shape(row)) === JSON.stringify(child))) throw new Error('Arrays must be rectangular.');
  return [x.length, ...child];
}
const flatten = x => Array.isArray(x) ? x.flatMap(flatten) : x && Array.isArray(x.data) ? x.data.map(numeric) : [numeric(x)];
const nest = (data, dims) => dims.length === 0 ? data[0] : Array.from({length:dims[0]},(_,i) => nest(data.slice(i*data.length/dims[0],(i+1)*data.length/dims[0]),dims.slice(1)));
export function reshape(x, dims) { shape(x); const data=flatten(x); if (!Array.isArray(dims) || !dims.length || !dims.every(n=>Number.isInteger(n)&&n>0) || dims.reduce((a,b)=>a*b,1)!==data.length) throw new Error('Reshape must preserve element count.'); return nest(data,dims); }
const matrix = x => { const dims=shape(x); if(dims.length!==2)throw new Error('Expected a matrix.'); return Array.isArray(x)?x:reshape(x,dims); };
export function transpose(x) { const a=matrix(x); return a[0].map((_,j)=>a.map(row=>row[j])); }
export function matmul(x,y) { const a=matrix(x), b=matrix(y); if(a[0].length!==b.length)throw new Error('Matrix inner dimensions must match.'); return a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0))); }
function elementwise(x,y,fn) {
  const a=shape(x),b=shape(y),rank=Math.max(a.length,b.length);
  const left=Array(rank-a.length).fill(1).concat(a),right=Array(rank-b.length).fill(1).concat(b);
  const dims=left.map((n,i)=>{if(n!==right[i]&&n!==1&&right[i]!==1)throw new Error('Shapes must match or broadcast along dimensions of size one.');return Math.max(n,right[i]);});
  const av=flatten(x),bv=flatten(y),size=dims.reduce((n,d)=>n*d,1);
  const offset=(shape,coords)=>shape.reduce((index,n,i)=>index*n+(n===1?0:coords[i]),0);
  const out=Array.from({length:size},(_,i)=>{let index=i;const coords=Array(rank);for(let d=rank-1;d>=0;d--){coords[d]=index%dims[d];index=Math.floor(index/dims[d]);}return fn(av[offset(left,coords)],bv[offset(right,coords)]);});
  return dims.length?nest(out,dims):out[0];
}
export function map(x,fn) { const dims=shape(x); const data=flatten(x).map(fn); return dims.length?nest(data,dims):data[0]; }
export const add=(a,b)=>elementwise(a,b,(x,y)=>x+y);
export const multiply=(a,b)=>elementwise(a,b,(x,y)=>x*y);
export function dot(a,b) { if(shape(a).length!==1||shape(b).length!==1||shape(a)[0]!==shape(b)[0])throw new Error('Dot product needs equal-length vectors.');const av=flatten(a),bv=flatten(b);return av.reduce((s,x,i)=>s+x*bv[i],0); }
export function cross(a,b) { if(shape(a).join()!=='3'||shape(b).join()!=='3')throw new Error('Cross product needs two 3D vectors.');a=flatten(a);b=flatten(b);return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
export function softmax(x) { const dims=shape(x);if(dims.length>1)return (Array.isArray(x)?x:reshape(x,dims)).map(softmax);if(!dims.length)throw new Error('Softmax needs a vector or tensor.');x=flatten(x);const max=Math.max(...x), e=x.map(v=>Math.exp(v-max)),sum=e.reduce((a,b)=>a+b,0);return e.map(v=>v/sum); }
export const gelu=x=>map(x,v=>0.5*v*(1+Math.tanh(Math.sqrt(2/Math.PI)*(v+0.044715*v**3))));
export function layerNorm(x, epsilon=1e-5) { if(!Number.isFinite(epsilon)||epsilon<=0)throw new Error('epsilon must be positive.');const dims=shape(x);if(!dims.length)throw new Error('Layer normalization needs an array.');if(dims.length>1)return (Array.isArray(x)?x:reshape(x,dims)).map(row=>layerNorm(row,epsilon));x=flatten(x);const mean=x.reduce((a,b)=>a+b,0)/x.length,variance=x.reduce((a,b)=>a+(b-mean)**2,0)/x.length;return x.map(v=>(v-mean)/Math.sqrt(variance+epsilon)); }
export function attention(q,k,v,causal=false) { const Q=matrix(q),K=matrix(k),V=matrix(v);if(Q[0].length!==K[0].length||K.length!==V.length)throw new Error('Attention requires matching Q/K widths and K/V sequence lengths.');const scores=matmul(Q,transpose(K)).map((row,i)=>row.map((s,j)=>causal&&j>i?-1e9:s/Math.sqrt(Q[0].length)));return matmul(softmax(scores),V); }
export function tensorContract(a,b) { const sa=shape(a),sb=shape(b);if(!sa.length||!sb.length||sa.at(-1)!==sb[0])throw new Error('Last/first tensor dimensions must match.');const left=sa.slice(0,-1).reduce((a,b)=>a*b,1),right=sb.slice(1).reduce((a,b)=>a*b,1),inner=sb[0];const out=matmul(reshape(a,[left,inner]),reshape(b,[inner,right]));const dims=[...sa.slice(0,-1),...sb.slice(1)];return dims.length?reshape(out,dims):out[0][0]; }
