import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { makeJsNode } = await server.ssrLoadModule('/src/js-recipes.ts');
  const { serializeDiagram, parseDiagram, makeNode } = await server.ssrLoadModule('/src/model.ts');
  const { mathLibrary } = await server.ssrLoadModule('/src/default-libraries.ts');
  for (const full of [false,true]) {
    const nodes = [], edges = [];
    const block = (id,recipe,x,y,label,parameter) => {
      const node=recipe==='Viewer'?makeNode('renderer',{x,y},id):makeJsNode(recipe,{x,y},id);
      node.width=240;node.height=180;node.data.label=label;
      if(parameter!==undefined)node.data.value=JSON.stringify(parameter);
      nodes.push(node);return node;
    };
    const wire=(from,to,index=0)=>edges.push({id:`${from}-${to}-${index}`,source:from,sourceHandle:'out-0',target:to,targetHandle:`in-${index}`,type:'smoothstep'});
    const matrix=(id,x,y,label,value)=>block(id,'Matrix',x,y,label,value);
    if(full){
      matrix('tokens',0,300,'X · token embeddings · 2 × 2',[[1,0],[0,1]]);
      for(const [id,y,weights] of [['query',0,[[1,.5],[0,1]]],['key',300,[[1,0],[.5,1]]],['value',600,[[1,2],[3,1]]]]){
        matrix(`w-${id}`,0,y+900,`W${id[0]} · 2 × 2`,weights);
        block(id,'MatMul',340,y,`${id[0].toUpperCase()+id.slice(1)} · X W${id[0]}`);
        wire('tokens',id);wire(`w-${id}`,id,1);
      }
    }else{
      matrix('query',0,0,'Q · queries · 2 × 2',[[1,.5],[0,1]]);
      matrix('key',0,300,'K · keys · 2 × 2',[[1,0],[.5,1]]);
      matrix('value',0,600,'V · values · 2 × 2',[[1,2],[3,1]]);
    }
    const x=full?680:340;
    block('key-transpose','Transpose',x,300,'Kᵀ · transpose keys');wire('key','key-transpose');
    block('scores','MatMul',x+340,0,'Q Kᵀ · attention scores');wire('query','scores');wire('key-transpose','scores',1);
    block('scaled-scores','Gain',x+680,0,'Scale · 1 / √dₖ',1/Math.sqrt(2));wire('scores','scaled-scores');
    block('probabilities','Softmax',x+1020,0,'Softmax · each row sums to 1');wire('scaled-scores','probabilities');
    block('attention','MatMul',x+1360,300,'Attention · softmax(scores) V');wire('probabilities','attention');wire('value','attention',1);
    matrix('w0',x+1360,600,'W₀ · output weights · 2 × 2',[[1,.25],[.5,1]]);
    block('projection','MatMul',x+1700,300,'Output projection · attention W₀');wire('attention','projection');wire('w0','projection',1);
    let last='projection',end=x+2040;
    if(full){
      block('residual1','Add',end,300,'Residual · X + attention W₀');wire(last,'residual1');wire('tokens','residual1',1);
      block('norm1','LayerNorm',end+340,300,'Layer norm · attention');wire('residual1','norm1');
      matrix('w1',end+680,600,'W₁ · FFN expansion · 2 × 4',[[1,0,1,-.5],[0,1,.5,1]]);
      block('ffn-up','Linear',end+680,300,'Neural net · H W₁ + b₁',{a:[[0,0]],b:[[1,0,1,0],[0,1,0,1]],c:[.1,0,.1,0]});wire('norm1','ffn-up');wire('w1','ffn-up',1);
      block('activation','GELU',end+1020,300,'Neural net · GELU activation');wire('ffn-up','activation');
      matrix('w2',end+1360,600,'W₂ · FFN contraction · 4 × 2',[[.5,0],[0,.5],[.5,0],[0,.5]]);
      block('ffn-down','Linear',end+1360,300,'Neural net · GELU(H W₁ + b₁) W₂ + b₂',{a:[[0,0,0,0]],b:[[.5,0],[0,.5],[.5,0],[0,.5]],c:[0,0]});wire('activation','ffn-down');wire('w2','ffn-down',1);
      block('residual2','Add',end+1700,300,'Residual · H + FFN(H)');wire('ffn-down','residual2');wire('norm1','residual2',1);
      block('norm2','LayerNorm',end+2040,300,'Layer norm · transformer output');wire('residual2','norm2');
      last='norm2';end+=2380;
    }
    block('output','Viewer',end,300,full?'Transformer output · 2 × 2':'Projected attention output · 2 × 2');wire(last,'output');
    const project={version:1,name:full?'Transformer forward · explicit single head':'Attention · step by step',modules:[mathLibrary],nodes,edges,viewport:{x:40,y:80,zoom:full?.2:.32}};
    const source=serializeDiagram(project);parseDiagram(source);
    await writeFile(new URL(`../examples/${full?'transformer-forward':'attention-step-by-step'}.json`,import.meta.url),source+'\n');
  }
} finally { await server.close(); }
