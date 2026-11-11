import { isControlled } from '@/block-code';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './editor-ui';
import { type BlockData, type BlockNode, type BlockVisuals, type FlowSettings } from '@/model';
export function VisualProperties({ node, update, resize }: { node: BlockNode; update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void }) {
  const v = node.data.visuals ?? {};
  const change = (patch: Partial<BlockVisuals>) => update({ visuals: { ...v, ...patch } });
  return <section className="property-section">
    <h3>Appearance</h3>
    {!!node.data.controlledProperties?.length && <div className="controlled-properties"><p className="field-help">Locked by code. Remove its <code>setProperty()</code> call before releasing a field.</p>{node.data.controlledProperties.map(path => <div key={path}><code>{path}</code><Button size="sm" variant="ghost" onClick={() => update({ controlledProperties: node.data.controlledProperties!.filter(p => p !== path) })}>Release</Button></div>)}</div>}
    <div className="dimension-fields"><Field label="Fill"><Input type="color" disabled={isControlled(node.data, 'visuals.background')} title={isControlled(node.data, 'visuals.background') ? 'Controlled by code' : undefined} aria-label="Block fill" value={v.background ?? '#ffffff'} onChange={e => change({ background: e.target.value })}/></Field><Field label="Ink"><Input type="color" disabled={isControlled(node.data, 'visuals.foreground')} title={isControlled(node.data, 'visuals.foreground') ? 'Controlled by code' : undefined} aria-label="Block ink" value={v.foreground ?? '#171717'} onChange={e => change({ foreground: e.target.value })}/></Field></div>
    <Button variant="outline" size="sm" disabled={isControlled(node.data, 'visuals.background') || isControlled(node.data, 'visuals.foreground')} onClick={() => update({ visuals: { ...v, background: undefined, foreground: undefined } })}>Use theme colors</Button>
    <div className="dimension-fields">{(['width', 'height'] as const).map(d => <Field key={d} label={d === 'width' ? 'Width (px)' : 'Height (px)'}><Input type="number" disabled={isControlled(node.data, d)} aria-label={`Block ${d}`} min={d === 'width' ? 120 : 90} max={2000} value={node[d] ?? (d === 'width' ? 164 : 116)} onChange={e => resize(d, Number(e.target.value))}/></Field>)}</div>
    <Field label="Corner radius"><Input disabled={isControlled(node.data, 'visuals.radius')} title={isControlled(node.data, 'visuals.radius') ? 'Controlled by code' : undefined} aria-label="Block corner radius" type="number" min={0} max={60} value={v.radius ?? 9} onChange={e => change({ radius: Math.max(0, Math.min(60, Number(e.target.value))) })}/></Field>
    {([['showHeader', 'Type breadcrumb'], ['showLabel', 'Block label'], ['showValue', 'Mask content'], ['showPortLabels', 'Port names on hover']] as const).map(([key, label]) => <label className="visibility-option" key={key}><span>{label}</span><input disabled={isControlled(node.data, `visuals.${key}`)} type="checkbox" checked={v[key] !== false} onChange={e => change({ [key]: e.target.checked })}/></label>)}
  </section>;
}
export function ConnectionProperties({ settings, update }: { settings: FlowSettings; update: (patch: FlowSettings) => void }) {
  return <><Field label="Path"><select aria-label="Connection path" value={settings.route ?? 'smoothstep'} onChange={e => update({ route: e.target.value as FlowSettings['route'] })}><option value="smoothstep">Orthogonal</option><option value="bezier">Bézier curve</option></select></Field>
    <p className="field-help">Double-click a wire to add a waypoint. Select the wire, then drag its points to shape it. Double-click a point to remove it.</p>
    <Button variant="outline" size="sm" disabled={!settings.points?.length} onClick={() => update({ points: [] })}>Reset waypoints</Button>
    <Field label="Flow animation"><select aria-label="Flow animation" value={settings.animation ?? 'none'} onChange={e => update({ animation: e.target.value as FlowSettings['animation'] })}><option value="none">None</option><option value="dash">Moving dashes</option><option value="pulse">Travelling pulse</option></select></Field>
    <Field label="Travel time (seconds)"><Input aria-label="Animation travel time" type="number" min={0.1} max={20} step={0.1} value={settings.speed ?? 2} onChange={e => update({ speed: Math.max(0.1, Math.min(20, Number(e.target.value))) })}/></Field>
    <label className="visibility-option"><span>Reverse flow</span><input type="checkbox" checked={settings.reverse ?? false} onChange={e => update({ reverse: e.target.checked })}/></label>
    <div className="dimension-fields"><Field label="Wire color"><Input aria-label="Wire color" type="color" value={settings.color ?? '#737373'} onChange={e => update({ color: e.target.value })}/></Field><Field label="Stroke width"><Input aria-label="Wire width" type="number" min={1} max={8} value={settings.width ?? 1.5} step={0.5} onChange={e => update({ width: Math.max(1, Math.min(8, Number(e.target.value))) })}/></Field></div>
  </>;
}
