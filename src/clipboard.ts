import { interfacePorts, makeNode, parseDiagram, serializeDiagram, type Canvas, type Diagram } from './model';
import { parseModules, type ProjectModule } from './project/schema';
export type BlockClipboard = { type: 'milver.blocks'; version: 1; canvas: Canvas; modules: ProjectModule[] };
export function copySelection(canvas: Canvas, modules: ProjectModule[] = []): BlockClipboard | undefined {
  const nodes=canvas.nodes.filter(n=>n.selected);if(!nodes.length)return;
  const ids=new Set(nodes.map(n=>n.id));
  const selected={...canvas,nodes,edges:canvas.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
  // Strip transient React Flow state while retaining nested canvases and wiring.
  const clean=JSON.parse(serializeDiagram({version:1,name:'Copied blocks',...selected}));
  return {type:'milver.blocks',version:1,canvas:{nodes:clean.nodes,edges:clean.edges,viewport:clean.viewport},modules:structuredClone(modules)};
}
export function parseClipboard(text: string): BlockClipboard {
  if(text.length>10_000_000)throw new Error('Copied selection is too large.');
  const value=JSON.parse(text);if(value?.type!=='milver.blocks'||value.version!==1||!value.canvas)throw new Error('The clipboard does not contain milver blocks.');
  const parent=makeNode('subsystem',{x:0,y:0},'clipboard-parent');parent.data.canvas=value.canvas;parent.data.ports=interfacePorts(value.canvas);
  const parsed=parseDiagram(JSON.stringify({version:1,name:'Clipboard',nodes:[parent],edges:[],viewport:{x:0,y:0,zoom:1}}));
  return {type:'milver.blocks',version:1,canvas:parsed.nodes[0].data.canvas!,modules:parseModules(value.modules??[])};
}
export function pasteSelection(canvas: Canvas, payload: BlockClipboard, offset = 40): Canvas {
  function clone(source: Canvas, top: boolean): { canvas: Canvas; ids: Map<string,string> } {
    const ids=new Map(source.nodes.map(n=>[n.id,crypto.randomUUID()]));const handles=new Map<string,Map<string,string>>();
    const nodes=source.nodes.map(n=>{
      const data=structuredClone(n.data);
      if(data.canvas){const child=clone(data.canvas,false);handles.set(n.id,child.ids);data.canvas=child.canvas;data.ports=interfacePorts(child.canvas);}
      return {...n,id:ids.get(n.id)!,data,position:{x:n.position.x+(top?offset:0),y:n.position.y+(top?offset:0)},selected:top};
    });
    const edges=source.edges.map(e=>({...e,id:crypto.randomUUID(),source:ids.get(e.source)!,target:ids.get(e.target)!,sourceHandle:handles.get(e.source)?.get(e.sourceHandle!)??e.sourceHandle,targetHandle:handles.get(e.target)?.get(e.targetHandle!)??e.targetHandle,selected:false}));
    return {ids,canvas:{...source,nodes,edges}};
  }
  const copied=clone(payload.canvas,true).canvas;
  return {...canvas,nodes:[...canvas.nodes.map(n=>({...n,selected:false})),...copied.nodes],edges:[...canvas.edges.map(e=>({...e,selected:false})),...copied.edges]};
}
export function mergeClipboardLibraries(current: ProjectModule[], copied: ProjectModule[]): ProjectModule[] {
  const result=[...current];
  for(const module of copied){const existing=result.find(m=>m.alias===module.alias);if(existing){if(JSON.stringify({...existing,id:''})!==JSON.stringify({...module,id:''}))throw new Error(`Library ${module.alias} differs from the copied project.`);}else result.push({...module,id:result.some(m=>m.id===module.id)?crypto.randomUUID():module.id});}
  return parseModules(result);
}
