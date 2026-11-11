import { expect,it } from 'vitest';
import { exampleDiagram,defaultTheme,parseDiagram,serializeDiagram } from './model';
import { canvasBackground } from './theme';
it('round trips canvas grid and gradient choices and rejects invalid settings',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,showGrid:false,canvasBackground:'aurora'};
  expect(parseDiagram(serializeDiagram(d)).theme).toEqual(d.theme);
  expect(canvasBackground(d.theme)).toContain('radial-gradient');
  (d.theme as any).showGrid='no';expect(()=>parseDiagram(serializeDiagram(d))).toThrow('appearance');
});
