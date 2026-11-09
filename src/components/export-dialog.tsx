import { useEffect, useMemo, useState } from 'react';
import { Braces, Check, Code2, Copy, Download, FileImage, Film, Image, LoaderCircle, MousePointer2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Field } from './editor-ui';
import { buildScene, collectPages, defaultExportOptions, rasterSize, sceneSvg, type ExportFormat } from '@/export/scene';
import { createExport, downloadBlob } from '@/export/download';
import type { Diagram } from '@/model';

const formats = [
  { id: 'png', name: 'PNG', icon: Image, description: 'High-resolution image' },
  { id: 'svg', name: 'SVG', icon: FileImage, description: 'Scalable vector image' },
  { id: 'gif', name: 'GIF', icon: Film, description: 'Looping connection animation' },
  { id: 'html', name: 'HTML', icon: Code2, description: 'Self-contained interactive viewer' },
  { id: 'json', name: 'JSON', icon: Braces, description: 'Editable diagram source' },
] as const;
export function ExportDialog({ open, onOpenChange, diagram, path, notify }: { open: boolean; onOpenChange: (open: boolean) => void; diagram: Diagram; path: string[]; notify: (message: string) => void }) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [options, setOptions] = useState(defaultExportOptions);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const [error, setError] = useState(''); const [preview, setPreview] = useState('');
  const [lastDownload, setLastDownload] = useState('');
  const prepared = useMemo(() => {
    if (!open) return { scene: null, pages: [], error: '' };
    try {
      const pages = collectPages(diagram, path, options.scope);
      const scene = buildScene(diagram, pages, options);
      return { scene, pages, error: '' };
    } catch (e) { return { scene: null, pages: [], error: e instanceof Error ? e.message : 'Could not prepare the export.' }; }
  }, [open, diagram, path, options]);
  useEffect(() => { setLastDownload(''); }, [options, format]);
  const supportsTransparency = format === 'png' || format === 'svg';
  useEffect(() => {
    if (!prepared.scene) { setPreview(''); return; }
    const url = URL.createObjectURL(new Blob([sceneSvg(prepared.scene, { ...options, transparent: supportsTransparency && options.transparent })], { type: 'image/svg+xml;charset=utf-8' }));
    setPreview(url); return () => URL.revokeObjectURL(url);
  }, [prepared.scene, options, supportsTransparency]);
  const pixels = prepared.scene ? rasterSize(prepared.scene, options.width, format === 'gif' ? 'gif' : 'png') : null;
  const download = async () => {
    setBusy(true); setError(''); setProgress(0); setLastDownload('');
    try {
      const result = await createExport(diagram, path, format, options, setProgress);
      downloadBlob(result.blob, result.filename); setLastDownload(result.filename); notify(`${format.toUpperCase()} exported`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed. Try SVG or a smaller image width.'); }
    finally { setBusy(false); }
  };
  const embedCode = lastDownload ? format === 'html' ? `<iframe src="${lastDownload}" title="Diagram" width="100%" height="600" style="border:0" loading="lazy"></iframe>` : `<img src="${lastDownload}" alt="Diagram" style="max-width:100%;height:auto" loading="lazy">` : '';
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="export-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle className="dialog-title"><Download/>Export diagram</DialogTitle><DialogDescription>Publish your diagram as an image or an interactive page. Editor controls are excluded.</DialogDescription></DialogHeader>
    <div className="export-formats" role="group" aria-label="Export format">{formats.map(f => <Button key={f.id} variant={format === f.id ? 'secondary' : 'ghost'} aria-pressed={format === f.id} disabled={busy} onClick={() => { setFormat(f.id); setOptions(o => ({ ...o, ...(f.id === 'gif' ? { width: Math.min(o.width, 1600) } : {}), ...(f.id === 'html' ? { scope: 'system' } : {}) })); setError(''); setLastDownload(''); }}><f.icon/>{f.name}</Button>)}</div>
    <div className="export-layout"><div className="export-preview"><div className={supportsTransparency && options.transparent ? 'export-image checkerboard' : 'export-image'}>{preview && <img src={preview} alt="Diagram export preview"/>}{!preview && <span>Preview unavailable</span>}</div><div className="export-preview-caption"><span>{formats.find(f => f.id === format)?.description}</span>{format === 'png' || format === 'gif' ? <Badge variant="outline">{pixels?.width ?? 0} × {pixels?.height ?? 0}</Badge> : <Badge variant="outline">{format === 'svg' ? 'Vector' : format === 'html' ? 'Offline-ready' : 'Version 1'}</Badge>}</div></div>
      <div className="export-options">
        <Field label="Content"><Select value={options.scope} onValueChange={scope => { setOptions(o => ({ ...o, scope: scope as 'current' | 'system' })); setLastDownload(''); }} disabled={busy || format === 'json'}><SelectTrigger aria-label="Export content" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="current">Current canvas</SelectItem><SelectItem value="system">Entire system</SelectItem></SelectContent></Select></Field>
        <p className="export-note">{format === 'json' ? 'JSON always includes the entire editable system and its theme.' : options.scope === 'system' ? format === 'html' ? 'Includes all nested canvases. Double-click parent blocks to navigate.' : `${prepared.pages.length} canvases, arranged as labeled sheets in one image.` : 'Includes every block in this canvas, even those outside your current view.'}</p>
        {(format === 'png' || format === 'gif') && <Field label="Image width"><Select value={String(options.width)} onValueChange={width => { setOptions(o => ({ ...o, width: Number(width) })); setLastDownload(''); }} disabled={busy}><SelectTrigger aria-label="Image width" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[800, 1200, 1600, ...(format === 'png' ? [2400, 3200, 4096] : [])].map(width => <SelectItem value={String(width)} key={width}>{width} px</SelectItem>)}</SelectContent></Select></Field>}
        {format !== 'json' && <><Separator/><div className="export-toggle"><Label htmlFor="export-title">Diagram title</Label><Switch id="export-title" size="sm" checked={options.title} disabled={busy || format === 'html'} onCheckedChange={title => setOptions(o => ({ ...o, title }))}/></div><div className="export-toggle"><Label htmlFor="export-grid">Dot grid</Label><Switch id="export-grid" size="sm" checked={options.grid} disabled={busy} onCheckedChange={grid => setOptions(o => ({ ...o, grid }))}/></div>{supportsTransparency && <div className="export-toggle"><Label htmlFor="export-transparent">Transparent background</Label><Switch id="export-transparent" size="sm" checked={options.transparent} disabled={busy} onCheckedChange={transparent => setOptions(o => ({ ...o, transparent }))}/></div>}</>}
        {format === 'gif' && <><div className="export-toggle"><Label htmlFor="export-animate">Animate connections</Label><Switch id="export-animate" size="sm" checked={options.animate} disabled={busy} onCheckedChange={animate => setOptions(o => ({ ...o, animate }))}/></div><p className="export-note">A seamless 1.92-second loop. Moving dots illustrate connections; they do not represent simulation results. GIF uses a solid background and up to 256 colors.</p></>}
        {format === 'html' && <p className="export-note"><MousePointer2/>Pan and zoom. <Network/>Use Entire system to explore parent blocks. No dependencies, server, or internet connection required.</p>}
      </div>
    </div>
    {lastDownload && format !== 'json' && <div className="export-embed"><div><Check/><span>Downloaded {lastDownload}</span></div><div className="export-embed-code"><Input aria-label="Embed code" readOnly value={embedCode}/><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(embedCode).then(() => notify('Embed code copied'), () => notify('Select and copy the embed code.'))}><Copy/>Copy embed</Button></div><p className="export-note">Upload the downloaded file to your site, then use this embed code. Change the src path to its published URL.</p></div>}
    {(error || prepared.error) && <p className="json-error" role="alert">{error || prepared.error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button><Button disabled={busy || !prepared.scene} onClick={() => void download()}>{busy ? <LoaderCircle className="animate-spin"/> : <Download/>}{busy ? format === 'gif' ? `Encoding ${progress}%` : 'Preparing…' : `Download ${format.toUpperCase()}`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
