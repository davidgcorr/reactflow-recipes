export const numericRender = `// state.result: numeric scalar, vector, matrix, nested tensor or { shape, data }.
// Tune precision here; limit rows/columns to keep large tensors readable.
const precision = 4;
const fontSize = 24; // Font size in pixels; increase for a larger formula.
const format = x => x === Infinity ? '∞' : x === -Infinity ? '-∞' : Number(x.toPrecision(precision)).toString();
const matrix = rows => String.raw\`\\begin{bmatrix}\${rows.slice(0, 8).map(row => row.slice(0, 8).map(format).join(' & ')).join(String.raw\` \\\\ \`)}\\end{bmatrix}\`;
let result = state.result;
let prefix = '';
if (result?.$ref && Array.isArray(result.rows)) result = result.rows;
if (result && Array.isArray(result.shape)) {
  // Show the first 2D slice; change this slice offset for another tensor page.
  const shape = result.shape, cols = shape.at(-1), rows = shape.at(-2) ?? 1;
  prefix = String.raw\`\\mathcal{T}_{\${shape.join(String.raw\` \\times \`)}} = \`;
  result = Array.from({ length: Math.min(rows, 8) }, (_, i) => result.data.slice(i * cols, (i + 1) * cols));
}
while (Array.isArray(result?.[0]?.[0])) result = result[0];
const tex = typeof result === 'number' ? format(result)
  : Array.isArray(result) ? matrix(Array.isArray(result[0]) ? result : [result]) : String.raw\`\\text{Connect a numeric input}\`;
return latex(element, prefix + tex, { fontSize });`;

const definitions = [
  ['MatMul', 'Matrix multiply', 'AB', 'matmul', 2, { a: [[1,2],[3,4]], b: [[1],[2]] }],
  ['Add', 'Add / residual', '+', 'add', 2, { a: [[1,2]], b: [[3,4]] }],
  ['Multiply', 'Multiply / scale', '×', 'multiply', 2, { a: [[1,2]], b: 0.5 }],
  ['Dot', 'Dot product', 'a·b', 'dot', 2, { a: [1,2,3], b: [4,5,6] }],
  ['Cross', 'Cross product', 'a×b', 'cross', 2, { a: [1,0,0], b: [0,1,0] }],
  ['Transpose', 'Transpose', 'Aᵀ', 'transpose', 1, { a: [[1,2],[3,4]] }],
  ['Softmax', 'Softmax', 'σ', 'softmax', 1, { a: [[1,2,3]] }],
  ['GELU', 'GELU', 'φ', 'gelu', 1, { a: [[-1,0,1]] }],
  ['LayerNorm', 'Layer norm', 'LN', 'layerNorm', 1, { a: [[1,2,3]], epsilon: 0.00001 }],
  ['Reshape', 'Reshape tensor', '↔', 'reshape', 1, { a: [[1,2],[3,4]], shape: [4] }],
  ['TensorContract', 'Tensor contract', '⊗', 'tensorContract', 2, { a: [[1,2],[3,4]], b: [[1],[2]] }],
  ['Attention', 'Scaled attention', 'QKV', 'attention', 3, { a: [[1,0],[0,1]], b: [[1,0],[0,1]], c: [[1,2],[3,4]], causal: false }],
  ['Linear', 'Linear projection', 'Wx+b', 'linear', 3, { a: [[1,2]], b: [[1,0],[0,1]], c: [[0,0]] }],
] as const;
const baseOperatorRecipes = Object.fromEntries(definitions.map(([id, label, symbol, fn, count, defaults]) => {
  const args = Array.from({length:count},(_,i)=>`inputs.input${i+1} ?? config.${['a','b','c'][i]}`);
  if (fn === 'layerNorm') args.push('config.epsilon ?? 1e-5');
  if (fn === 'reshape') args.push('config.shape');
  if (fn === 'attention') args.push('config.causal ?? false');
  const calculation = fn === 'linear' ? `modules.tensorMath.add(modules.tensorMath.matmul(${args[0]}, ${args[1]}), ${args[2]})` : `modules.tensorMath.${fn}(${args.join(', ')})`;
  return [id, { label, symbol, category: 'Operators', inputs: count, outputs: 1, value: JSON.stringify(defaults), source: `await modules.tensorMath.ready;\n// Inputs override the example defaults stored in Parameter.\nconst config = JSON.parse(value);\nif (!modules.tensorMath) throw new Error('Import the math library from Libraries.');\nstate.result = ${calculation};\nemit(state.result);\nawait render();`, render: numericRender }];
}));
export const operatorRecipes = {
  ...baseOperatorRecipes,
  Gain: { label: 'Gain', symbol: 'K', category: 'Operators', inputs: 1, outputs: 1, value: '2', source: `await modules.tensorMath.ready;
const gain = modules.tensorMath.parse(value);
if (typeof gain !== 'number') throw new Error('Enter a numeric gain.');
state.result = modules.tensorMath.multiply(inputs.input1 ?? 0, gain);
emit(state.result);
await render();`, render: numericRender },
};
export const sinkRecipes = {
  MathView: { label: 'Math viewer', symbol: '▦', category: 'Sinks', inputs: 1, outputs: 0, value: '', source: `state.result = inputs.input1;\nawait render();`, render: numericRender },
  LineGraph: { label: 'Line graph', symbol: '⌁', category: 'Sinks', inputs: 1, outputs: 0, value: '', source: `// Feed a numeric vector, or stream scalar samples (the last 128 are saved).\nconst input = inputs.input1;\nif (Array.isArray(input)) {\n  if (!input.every(Number.isFinite)) throw new Error('Line graph expects a numeric vector.');\n  state.samples = input.slice(-128);\n} else if (typeof input === 'number' && Number.isFinite(input)) {\n  state.samples = [...(state.samples ?? []), input].slice(-128);\n} else state.samples ??= [];\nawait render();`, render: `// state.samples: up to 128 values. Tune dimensions, color or scaling below.\nconst values = state.samples;\nif (!values.length) return <div style={{color:'#737373'}}>Connect a vector or numeric signal</div>;\nconst min = Math.min(...values), max = Math.max(...values);\nconst y = v => 95 - (v - min) / (max - min || 1) * 75;\nconst points = values.map((v, i) => [20 + i / Math.max(1, values.length - 1) * 220, y(v)].join(',')).join(' ');\nreturn <svg viewBox="0 0 260 120" width="100%" role="img" aria-label="Line graph">\n  <path d="M20 10V100H245" fill="none" stroke="#d4d4d4"/>\n  <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/>\n  <text x="24" y="115" fontSize="9" fill="#737373">{values.length} samples · {min.toFixed(2)} — {max.toFixed(2)}</text>\n</svg>;` },
  ScatterPlot: { label: 'Scatter plot', symbol: '⠿', category: 'Sinks', inputs: 1, outputs: 0, value: '', source: `// Connect [[x, y], ...] pairs; up to 256 points are displayed.\nconst points = inputs.input1;\nif (points != null && (!Array.isArray(points) || !points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) throw new Error('Scatter plot expects [[x, y], ...].');\nstate.points = (points ?? []).slice(0, 256);\nawait render();`, render: `// state.points: [[x, y], ...]. Tune radius, color or axes here.\nconst points = state.points;\nif (!points.length) return <div style={{color:'#737373'}}>Connect [x, y] pairs</div>;\nconst xs = points.map(p => p[0]), ys = points.map(p => p[1]);\nconst xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);\nreturn <svg viewBox="0 0 260 130" width="100%" role="img" aria-label="Scatter plot">\n  <path d="M20 10V110H245" fill="none" stroke="#d4d4d4"/>\n  {points.map(([x,y],i) => <circle key={i} cx={20 + (x-xmin)/(xmax-xmin || 1)*220} cy={105 - (y-ymin)/(ymax-ymin || 1)*90} r="3" fill="currentColor" opacity="0.7"/>)}\n</svg>;` },
};
