import { ModuleMask } from './module-mask';
import { viewerLogic, viewerRender } from '@/viewer-code';
import type { BlockNode, Port } from '@/model';
import type { RendererConfig } from '@/code-config';
const defaultPorts: Port[] = [{ id: 'in-0', name: 'in', type: 'input', side: 'left', variable: 'input1' }];
export function ValueRenderer({ id, settings = { precision: 4, slice: 0 }, data, color = 'var(--primary)', background = 'transparent', interactive = false }: { id: string; settings?: RendererConfig; data?: BlockNode['data']; color?: string; background?: string; interactive?: boolean }) {
  return <ModuleMask id={id} source={data?.module ?? viewerLogic} render={data?.render ?? viewerRender} state={data?.state} value={data?.value ?? ''} ports={data?.ports ?? defaultPorts} renderer={settings} interactive={interactive} color={color} background={background} dependencies={data?.dependencies}/>;
}
