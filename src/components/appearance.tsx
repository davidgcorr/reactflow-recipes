import { canvasBackground } from '@/theme';
import { Switch } from './ui/switch';
import { Moon, RotateCcw, Sun, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Field, IconButton } from './editor-ui';
import { defaultTheme, type ThemeSettings } from '@/model';

export function Appearance({ theme, update, close }: { theme: ThemeSettings; update: (patch: Partial<ThemeSettings>) => void; close: () => void }) {
  return <Card className="floating-panel appearance-panel" aria-label="Appearance"><div className="panel-header"><h2>Appearance</h2><IconButton label="Close appearance" onClick={close}><X/></IconButton></div><Separator/><div className="property-section">
    <Field label="Mode"><div className="segmented"><Button size="sm" variant={theme.mode === 'light' ? 'secondary' : 'ghost'} aria-pressed={theme.mode === 'light'} onClick={() => update({ mode: 'light' })}><Sun/>Light</Button><Button size="sm" variant={theme.mode === 'dark' ? 'secondary' : 'ghost'} aria-pressed={theme.mode === 'dark'} onClick={() => update({ mode: 'dark' })}><Moon/>Dark</Button></div></Field>
    <div className="export-toggle"><span>Show canvas grid</span><Switch aria-label="Show canvas grid" checked={theme.showGrid !== false} onCheckedChange={showGrid => update({ showGrid })}/></div>
    <div className="export-toggle"><span>Rough mode</span><Switch aria-label="Rough mode" checked={theme.rough === true} onCheckedChange={rough => update({ rough })}/></div>
    {theme.rough && <Field label={`Roughness · ${(theme.roughness ?? 1).toFixed(1)}`}><Slider aria-label="Roughness level" value={[theme.roughness ?? 1]} min={0} max={3} step={0.1} onValueChange={([roughness]) => update({ roughness })}/></Field>}
    <Field label="Canvas background"><div className="background-presets">{(['plain','aurora','ocean','sunset'] as const).map(preset => <Button key={preset} variant="outline" size="sm" aria-pressed={(theme.canvasBackground ?? 'plain') === preset} onClick={() => update({ canvasBackground: preset })}><span style={{ background: canvasBackground({ ...theme, canvasBackground: preset }) }}/>{preset[0].toUpperCase() + preset.slice(1)}</Button>)}</div></Field>
    <Field label="Palette"><div className="theme-presets">{[{ name: 'Monochrome', hue: 0, chroma: 0 }, { name: 'Violet', hue: 285, chroma: 0.17 }, { name: 'Blue', hue: 255, chroma: 0.17 }, { name: 'Green', hue: 155, chroma: 0.12 }].map(t => <Button key={t.name} variant="outline" size="sm" aria-label={`${t.name} palette`} aria-pressed={theme.hue === t.hue && theme.chroma === t.chroma} onClick={() => update({ hue: t.hue, chroma: t.chroma })}><span className="theme-swatch" style={{ background: `oklch(${t.chroma ? 0.55 : 0.2} ${t.chroma} ${t.hue})` }}/>{t.name}</Button>)}</div></Field>
    <Separator/><div className="section-heading color-space-heading"><h3>Color space</h3><Badge variant="outline">OKLCH</Badge></div>
    <Field label={`Hue · ${Math.round(theme.hue)}°`}><Slider aria-label="Theme hue" value={[theme.hue]} min={0} max={360} step={1} onValueChange={([hue]) => update({ hue })}/></Field>
    <Field label={`Chroma · ${theme.chroma.toFixed(2)}`}><Slider aria-label="Theme chroma" value={[theme.chroma]} min={0} max={0.22} step={0.01} onValueChange={([chroma]) => update({ chroma })}/></Field>
    <p className="field-help">Chroma 0 keeps the entire workspace black and white. Increase it to add color.</p>
    <Separator/><Field label={`Corner radius · ${theme.radius}px`}><Slider aria-label="Corner radius" value={[theme.radius]} min={0} max={20} step={1} onValueChange={([radius]) => update({ radius })}/></Field>
    <div className="theme-preview"><span/><span/><span/><span/><span/></div>
    <Button variant="outline" size="sm" className="w-full" onClick={() => update(defaultTheme)}><RotateCcw/>Reset to monochrome</Button>
  </div></Card>;
}
