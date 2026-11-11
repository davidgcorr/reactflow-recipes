import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { makeJsNode } = await server.ssrLoadModule('/src/js-recipes.ts');
  const { serializeDiagram, parseDiagram, makeNode } = await server.ssrLoadModule('/src/model.ts');
  const { mathLibrary } = await server.ssrLoadModule('/src/default-libraries.ts');
  const nodes = [], edges = [];
  const block = (id, recipe, x, y, config) => {
    const node = recipe === 'MathView' ? makeNode('renderer', {x,y}, id) : makeJsNode(recipe, {x,y}, id);
    node.width = recipe === 'MathView' ? 300 : 260; node.height = 200;
    if(config) node.data.value = JSON.stringify(config);
    nodes.push(node); return node;
  };
  const wire = (from,to,index=0) => edges.push({ id:`${from}-${to}-${index}`,source:from,sourceHandle:'out-0',target:to,targetHandle:`in-${index}`,type:'smoothstep' });
  const input=block('tokens','Matrix',0,300); input.data.value='[[1,0],[0,1]]';input.data.label='Token embeddings · 2 × 2';
  const projection={a:[[1,0],[0,1]],b:[[1,0],[0,1]],c:[0,0]};
  for(const [id,y] of [['query',0],['key',300],['value',600]]) { const n=block(id,'Linear',360,y,projection);n.data.label=`${id[0].toUpperCase()+id.slice(1)} projection`;wire('tokens',id); }
  block('attention','Attention',720,300);wire('query','attention');wire('key','attention',1);wire('value','attention',2);
  block('residual1','Add',1080,300);wire('attention','residual1');wire('tokens','residual1',1);
  block('norm1','LayerNorm',1440,300);wire('residual1','norm1');
  block('ffn-up','Linear',1800,300,{a:[[1,2]],b:[[1,0,1,0],[0,1,0,1]],c:[0,0,0,0]});wire('norm1','ffn-up');
  block('activation','GELU',2160,300);wire('ffn-up','activation');
  block('ffn-down','Linear',2520,300,{a:[[1,2,3,4]],b:[[0.5,0],[0,0.5],[0.5,0],[0,0.5]],c:[0,0]});wire('activation','ffn-down');
  block('residual2','Add',2880,300);wire('ffn-down','residual2');wire('norm1','residual2',1);
  block('norm2','LayerNorm',3240,300);wire('residual2','norm2');
  block('output','MathView',3600,300).data.label='Transformer output';wire('norm2','output');
  const project={version:1,name:'Transformer forward · single attention head',modules:[mathLibrary],nodes,edges,viewport:{x:30,y:120,zoom:0.35}};
  const source=serializeDiagram(project);parseDiagram(source);
  await writeFile(new URL('../examples/transformer-forward.json',import.meta.url),source+'\n');
} finally { await server.close(); }
