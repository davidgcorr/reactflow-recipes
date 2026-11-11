import { expect,it } from 'vitest';
import { roughPaths } from './rough';
import { defaultTheme,exampleDiagram,parseDiagram,serializeDiagram } from './model';
import { buildScene,collectPages,defaultExportOptions,sceneSvg } from './export/scene';
it('keeps hand-drawn paths stable between rerenders',()=>{
  const a=roughPaths('M0 0L100 0L100 100','edge-a','#333');
  expect(a).toEqual(roughPaths('M0 0L100 0L100 100','edge-a','#333'));
  expect(a).not.toEqual(roughPaths('M0 0L100 0L100 100','edge-b','#333'));
});
it('round trips rough mode and preserves it in publication output',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,rough:true};
  expect(parseDiagram(serializeDiagram(d)).theme?.rough).toBe(true);
  const scene=buildScene(d,collectPages(d,[],'current'),defaultExportOptions);
  expect(scene.rough).toBe(true);
  const svg=sceneSvg(scene,defaultExportOptions);
  expect(svg).toContain('C');expect(svg).toBe(sceneSvg(scene,defaultExportOptions));
  (d.theme as any).rough='yes';expect(()=>parseDiagram(serializeDiagram(d))).toThrow('rough');
});
it('round trips roughness and applies it to blocks, wires and exported arrows',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,rough:true,roughness:2.4};
  expect(parseDiagram(serializeDiagram(d)).theme?.roughness).toBe(2.4);
  const options=defaultExportOptions;
  const a=sceneSvg(buildScene(d,collectPages(d,[],'current'),options),options);
  d.theme.roughness=0;
  const b=sceneSvg(buildScene(d,collectPages(d,[],'current'),options),options);
  expect(a).not.toBe(b);
  expect(roughPaths('M0 0L100 100','test','#000',1,0)).not.toEqual(roughPaths('M0 0L100 100','test','#000',1,3));
  d.theme.roughness=3.1;expect(()=>parseDiagram(serializeDiagram(d))).toThrow('roughness');
});
