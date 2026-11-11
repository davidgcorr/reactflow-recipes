import { createContext, useContext, useMemo } from 'react';
import { roughGenerator, roughPaths, roughSeed } from '@/rough';
export const RoughContext=createContext({ enabled: false, roughness: 1 });
export function RoughPath({ d,id,color,width=1.5 }: { d:string;id:string;color:string;width?:number }) {
  const { roughness }=useContext(RoughContext);
  const paths=useMemo(()=>roughPaths(d,id,color,width,roughness),[d,id,color,width,roughness]);
  return <g className="rough-path" pointerEvents="none">{paths.map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill}/>)}</g>;
}
export function RoughBlockOutline({id,width,height,circle=false}:{id:string;width:number;height:number;circle?:boolean}) {
  const { enabled,roughness }=useContext(RoughContext);
  const paths=useMemo(()=>{if(!enabled)return [];const options={seed:roughSeed(id),stroke:'currentColor',strokeWidth:1.2,roughness,bowing:0.8};return roughGenerator.toPaths(circle?roughGenerator.ellipse(width/2,height/2,width-6,height-6,options):roughGenerator.rectangle(2,2,width-4,height-4,options));},[enabled,roughness,id,width,height,circle]);
  if(!enabled)return null;
  return <svg className="rough-block-outline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">{paths.map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill}/>)}</svg>;
}
