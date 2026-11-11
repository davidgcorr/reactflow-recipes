import rough from 'roughjs';
export const roughGenerator = rough.generator();
export function roughSeed(id: string): number {
  let value=2166136261;for(const char of id)value=Math.imul(value^char.charCodeAt(0),16777619);
  return (value>>>0)%2147483646+1;
}
export function roughPaths(path: string,id: string,color: string,width=1.5,roughness=1) {
  return roughGenerator.toPaths(roughGenerator.path(path,{seed:roughSeed(id),stroke:color,strokeWidth:width,roughness,bowing:0.8,preserveVertices:true}));
}
