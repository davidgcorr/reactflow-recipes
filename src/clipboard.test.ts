import { expect, it } from 'vitest';
import { copySelection, parseClipboard, pasteSelection, mergeClipboardLibraries } from './clipboard';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';
import { mathLibrary } from './default-libraries';
it('copies selected blocks and only their internal edges, with fresh IDs on every paste',()=>{
  const d=exampleDiagram();d.nodes=d.nodes.slice(0,3).map(n=>({...n,selected:true}));
  const selected=new Set(d.nodes.map(n=>n.id));d.edges=d.edges.filter(e=>selected.has(e.source)&&selected.has(e.target));
  const payload=parseClipboard(JSON.stringify(copySelection(d,[mathLibrary])));
  const pasted=pasteSelection(d,payload);
  const copies=pasted.nodes.filter(n=>n.selected);
  expect(copies).toHaveLength(3);expect(pasted.edges.length).toBe(d.edges.length+2);
  expect(new Set(pasted.nodes.map(n=>n.id)).size).toBe(6);
  expect(copies[0].position.x).toBe(d.nodes[0].position.x+40);
});
it('remaps parent interface IDs and nested wiring and round trips the result',()=>{
  const parent=makeNode('subsystem',{x:0,y:0},'parent');parent.selected=true;
  const d={...exampleDiagram(),nodes:[parent],edges:[]};
  const pasted=pasteSelection(d,parseClipboard(JSON.stringify(copySelection(d))));
  const copy=pasted.nodes[1];
  expect(copy.data.ports[0].id).not.toBe(parent.data.ports[0].id);
  expect(copy.data.ports[0].id).toBe(copy.data.canvas!.nodes[0].id);
  const result=parseDiagram(serializeDiagram({...d,...pasted}));expect(result.nodes).toHaveLength(2);
});
it('does not silently replace a library with a different implementation',()=>{
  expect(()=>mergeClipboardLibraries([mathLibrary],[{id:'other',alias:'math',source:'export const x=1;'}])).toThrow('differs');
});
