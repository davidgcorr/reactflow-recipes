import type { Diagram } from '../model';
import license from '../../THIRD_PARTY_NOTICES.txt?raw';
import { buildScene, collectPages, escapeXml, safeJson, sceneSvg, type ExportOptions } from './scene';

export function exportHtml(diagram: Diagram, path: string[], options: ExportOptions): string {
  const pages = collectPages(diagram, path, options.scope);
  const scenes = pages.map(page => buildScene(diagram, [page], { ...options, title: false }, false));
  // Links use numeric page IDs, never user-provided strings or executable attributes.
  const markup = pages.map((page, i) => {
    const scene = scenes[i];
    // Render each canvas separately; map child IDs to the page's local SVG block groups.
    let svg = sceneSvg(scene, { ...options, transparent: false }).replace('role="img"', 'role="group"');
    svg = svg.replaceAll('id="arrow"', `id="arrow-${i}"`).replaceAll('url(#arrow)', `url(#arrow-${i})`).replaceAll('id="grid"', `id="grid-${i}"`).replaceAll('url(#grid)', `url(#grid-${i})`).replaceAll('id="diagram-title"', `id="diagram-title-${i}"`).replaceAll('aria-labelledby="diagram-title"', `aria-labelledby="diagram-title-${i}"`);
    const children = pages.filter(child => child.parent === page.index);
    page.canvas.nodes.forEach((node, nodeIndex) => {
      const child = children.find(child => child.path.at(-1) === node.id);
      if (child) {
        const pattern = `<g data-block="${page.index}-${nodeIndex}"`;
        svg = svg.replace(pattern, `${pattern} data-enter="${child.index}" role="button" tabindex="0" aria-label="${escapeXml(`Enter ${node.data.label}`)}"`);
      }
    });
    return `<section class="sheet" data-page="${i}"${i ? ' hidden' : ''}>${svg}</section>`;
  }).join('');
  const p = scenes[0].palette;
  const metadata = pages.map((page, i) => ({ title: page.title, parent: page.parent, width: scenes[i].width, height: scenes[i].height }));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${diagram.theme?.mode ?? 'light'}"><meta name="generator" content="milver"><title>${escapeXml(pages[0].title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font:13px Inter,Arial,Helvetica,sans-serif;background:${p.background};color:${p.foreground}}button{font:inherit;cursor:pointer;color:inherit;background:${p.card};border:1px solid ${p.border};border-radius:6px;padding:7px 10px}button:hover{background:${p.secondary}}button:focus-visible,[data-enter]:focus-visible{outline:2px solid ${p.primary};outline-offset:3px}.bar{position:fixed;z-index:2;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:7px;pointer-events:none}.bar>*{pointer-events:auto}.crumbs{display:flex;align-items:center;gap:4px;min-width:0;overflow:auto;max-width:calc(100vw - 210px);background:${p.card};border:1px solid ${p.border};border-radius:8px;padding:4px}.crumbs button{border:0;font-size:11px;white-space:nowrap;padding:6px 8px}.crumbs span{color:${p.muted}}.tools{margin-left:auto;display:flex;gap:4px;background:${p.card};border:1px solid ${p.border};border-radius:8px;padding:4px}.tools button{border:0;min-width:30px}.tools output{display:flex;align-items:center;justify-content:center;width:42px;font-size:10px;color:${p.muted}}#viewport{position:absolute;inset:0;touch-action:none;cursor:grab}#viewport.dragging{cursor:grabbing}.sheet{position:absolute;left:0;top:0;transform-origin:0 0}.sheet[hidden]{display:none}.sheet svg{display:block;overflow:visible}.sheet [data-enter]{cursor:pointer}.sheet [data-enter]:hover>rect{stroke:${p.primary};stroke-width:1.5}.hint{position:fixed;bottom:12px;left:12px;font-size:10px;color:${p.muted};padding:6px 9px;background:${p.card};border:1px solid ${p.border};border-radius:6px;pointer-events:none}@media(max-width:500px){.crumbs{max-width:calc(100vw - 168px)}.tools{gap:0}.tools button{padding:6px}.hint{font-size:9px}}
@media(prefers-reduced-motion:no-preference){.sheet{will-change:transform}}
</style></head><body>
<nav class="bar" aria-label="Diagram navigation"><div class="crumbs" id="crumbs"></div><div class="tools"><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><output id="zoom" aria-live="polite">100%</output><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="fit" aria-label="Fit diagram" title="Fit diagram">⛶</button></div></nav>
<main id="viewport" aria-label="Diagram viewer">${markup}</main><div class="hint">Drag to pan · Scroll to zoom${pages.length > 1 ? ' · Double-click a parent to enter' : ''}</div>
<script id="pages" type="application/json">${safeJson(metadata)}</script>
<script>
(()=>{'use strict';const pages=JSON.parse(document.getElementById('pages').textContent),viewport=document.getElementById('viewport'),sheets=[...document.querySelectorAll('.sheet')],crumbs=document.getElementById('crumbs'),zoom=document.getElementById('zoom');let current=0,x=0,y=0,scale=1,drag=null,moved=false;const saved=new Map();
function render(){sheets[current].style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';zoom.textContent=Math.round(scale*100)+'%';saved.set(current,{x,y,scale});}
function fit(){const p=pages[current];scale=Math.max(.005,Math.min((innerWidth-40)/p.width,(innerHeight-120)/p.height,2));x=(innerWidth-p.width*scale)/2;y=(innerHeight-p.height*scale)/2+20;render();}
function navigate(index){if(!pages[index])return;sheets[current].hidden=true;current=index;sheets[current].hidden=false;const state=saved.get(current);if(state){({x,y,scale}=state);render();}else fit();crumbs.replaceChildren();const chain=[];for(let i=current;i!==null;i=pages[i].parent)chain.unshift(i);chain.forEach((id,j)=>{if(j){const sep=document.createElement('span');sep.textContent='›';crumbs.append(sep);}const button=document.createElement('button');button.type='button';button.textContent=pages[id].title.split(' / ').at(-1)||'Untitled';button.addEventListener('click',()=>navigate(id));if(id===current)button.setAttribute('aria-current','page');crumbs.append(button);});document.title=pages[current].title;}
function zoomAt(factor,cx=innerWidth/2,cy=innerHeight/2){const next=Math.max(.005,Math.min(8,scale*factor));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;render();}
viewport.addEventListener('wheel',event=>{event.preventDefault();zoomAt(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.002),event.clientX,event.clientY);},{passive:false});
viewport.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,originX:x,originY:y};moved=false;viewport.classList.add('dragging');});
viewport.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3){moved=true;if(!viewport.hasPointerCapture(event.pointerId))viewport.setPointerCapture(event.pointerId);}x=drag.originX+dx;y=drag.originY+dy;render();});
function release(){drag=null;viewport.classList.remove('dragging');}viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);
viewport.addEventListener('dblclick',event=>{const block=event.target.closest('[data-enter]');if(block&&!moved)navigate(Number(block.dataset.enter));});
viewport.addEventListener('keydown',event=>{const block=event.target.closest('[data-enter]');if(block&&(event.key==='Enter'||event.key===' ')){event.preventDefault();navigate(Number(block.dataset.enter));}});
document.getElementById('zoom-in').addEventListener('click',()=>zoomAt(1.2));document.getElementById('zoom-out').addEventListener('click',()=>zoomAt(1/1.2));document.getElementById('fit').addEventListener('click',fit);window.addEventListener('resize',fit);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&pages[current].parent!==null)navigate(pages[current].parent);if(event.key==='1')fit();});navigate(0);
})();
</script>
<!-- Third-party license notices retained with this self-contained publication.\n${license.replace(/-->/g, '-- >')} -->
</body></html>`;
}
