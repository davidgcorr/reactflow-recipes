import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, MarkerType, ConnectionLineType,
  applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow,
  type Connection, type Edge, type OnNodesChange, type OnEdgesChange,
} from '@xyflow/react';
import {
  ArrowLeft, ArrowUpRight, Braces, Check, ChevronRight, CircleHelp, Copy, Download, Expand,
  Grid3X3, GripVertical, Hand, Home, Map, Menu, Minus, MousePointer2, Network,
  Palette, PanelRight, Plus, Redo2, Search, Undo2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Appearance } from '@/components/appearance';
import { Block, BlockContext } from '@/components/block-node';
import { IconButton } from '@/components/editor-ui';
import { Inspector } from '@/components/inspector';
import {
  canvasAt, cleanEdges, defaultTheme, exampleDiagram, interfacePorts,
  makeNode, parseDiagram, serializeDiagram, templates, updateCanvas,
  type BlockData, type BlockNode, type Canvas, type Diagram, type Port, type ThemeSettings,
} from '@/model';
import { themeVariables } from '@/theme';

const nodeTypes = { block: Block };
const storageKey = 'milver.diagram.v1';
const uiKey = 'milver.workspace.v1';
type WorkspaceUI = { library: boolean; inspector: boolean; snap: boolean; minimap: boolean };
type HistoryEntry = { json: string; path: string[] };
function load() {
  for (const key of [storageKey, 'flowbench.diagram.v1']) {
    try { const json = localStorage.getItem(key); if (json) return { document: parseDiagram(json), fit: false }; } catch { /* Keep invalid saved data untouched and try the previous format. */ }
  }
  return { document: exampleDiagram(), fit: true };
}
function loadUI(): WorkspaceUI {
  const defaults = { library: true, inspector: true, snap: true, minimap: false };
  try {
    const saved = JSON.parse(localStorage.getItem(uiKey) ?? '{}');
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, typeof saved[key] === 'boolean' ? saved[key] : value])) as WorkspaceUI;
  } catch { return defaults; }
}

function Editor() {
  const [initial] = useState(load);
  const [document, setDocument] = useState(initial.document);
  const [path, setPath] = useState<string[]>([]);
  const [ui, setUI] = useState(loadUI);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [mode, setMode] = useState<'select' | 'pan'>('select');
  const [search, setSearch] = useState('');
  const [activePort, setActivePort] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(true);
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] });
  const documentRef = useRef(document); documentRef.current = document;
  const pathRef = useRef(path); pathRef.current = path;
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const flow = useReactFlow<BlockNode>();
  const canvas = canvasAt(document, path);
  const nodes = canvas.nodes; const edges = canvas.edges;
  const selected = nodes.find(n => n.selected);
  const selectedEdge = edges.find(e => e.selected);
  const theme = document.theme ?? defaultTheme;
  const nested = path.length > 0;
  const replace = useCallback((next: Diagram) => { documentRef.current = next; setDocument(next); }, []);
  const snapshot = useCallback(() => {
    const entry = { json: serializeDiagram(documentRef.current), path: [...pathRef.current] };
    setHistory(h => ({ past: [...h.past.slice(-49), entry], future: [] }));
  }, []);
  const editCanvas = useCallback((transform: (c: Canvas) => Canvas, remember = true) => {
    if (remember) snapshot();
    replace(updateCanvas(documentRef.current, pathRef.current, transform));
  }, [replace, snapshot]);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, serializeDiagram(document)); setSaved(true); }
      catch { notify('Could not save locally. Export JSON to keep a copy.'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [document, notify]);
  useEffect(() => { try { localStorage.setItem(uiKey, JSON.stringify(ui)); } catch { /* Workspace preferences are optional. */ } }, [ui]);
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme.mode === 'dark');
    for (const [key, value] of Object.entries(themeVariables(theme))) root.style.setProperty(key, value);
    root.style.colorScheme = theme.mode;
  }, [theme]);

  const restore = (entry: HistoryEntry) => {
    const next = parseDiagram(entry.json); let nextPath = entry.path;
    try { canvasAt(next, nextPath); } catch { nextPath = []; }
    setPath(nextPath); pathRef.current = nextPath; replace(next); setActivePort(null);
  };
  const undo = () => {
    if (!history.past.length) return;
    const last = history.past.at(-1)!;
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ json: serializeDiagram(documentRef.current), path: [...path] }, ...h.future] }));
    restore(last);
  };
  const redo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    setHistory(h => ({ past: [...h.past, { json: serializeDiagram(documentRef.current), path: [...path] }], future: h.future.slice(1) }));
    restore(next);
  };
  const goTo = (nextPath: string[]) => {
    // Viewports are stored per canvas; opening another level restores its own view.
    canvasAt(documentRef.current, nextPath);
    setPath(nextPath); pathRef.current = nextPath; setActivePort(null);
  };
  const enter = (id: string) => {
    if (nodes.find(n => n.id === id)?.data.canvas) {
      if (path.length >= 16) { notify('Maximum nesting depth is 16.'); return; }
      goTo([...path, id]);
    }
  };
  const onNodesChange: OnNodesChange<BlockNode> = useCallback(changes => {
    editCanvas(c => ({ ...c, nodes: applyNodeChanges(changes, c.nodes) }), changes.some(c => c.type === 'remove'));
  }, [editCanvas]);
  const onEdgesChange: OnEdgesChange = useCallback(changes => {
    editCanvas(c => ({ ...c, edges: applyEdgeChanges(changes, c.edges) }), changes.some(c => c.type === 'remove'));
  }, [editCanvas]);
  const validConnection = (connection: Connection | Edge) => {
    const c = canvasAt(documentRef.current, pathRef.current);
    return connection.source !== connection.target &&
      !!c.nodes.find(n => n.id === connection.source)?.data.ports.some(p => p.id === connection.sourceHandle && p.type === 'output') &&
      !!c.nodes.find(n => n.id === connection.target)?.data.ports.some(p => p.id === connection.targetHandle && p.type === 'input') &&
      !c.edges.some(e => e.target === connection.target && e.targetHandle === connection.targetHandle);
  };
  const connect = (connection: Connection) => {
    if (validConnection(connection)) editCanvas(c => ({ ...c, edges: addEdge({ ...connection, type: 'smoothstep' }, c.edges) }));
  };
  const availableTemplates = templates.filter(t => nested || t.kind !== 'inport' && t.kind !== 'outport');
  const addBlock = (kind: string, point?: { x: number; y: number }) => {
    if (!nested && (kind === 'inport' || kind === 'outport')) return;
    if (kind === 'subsystem' && path.length >= 16) { notify('Maximum nesting depth is 16.'); return; }
    const center = flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const node = makeNode(kind, point ?? { x: center.x - 82, y: center.y - 58 });
    if (ui.snap) node.position = { x: Math.round(node.position.x / 20) * 20, y: Math.round(node.position.y / 20) * 20 };
    if (node.data.canvas) {
      // Center a freshly created subsystem's internal graph without changing later saved views.
      node.data.canvas.viewport = { x: window.innerWidth / 2 - 362, y: window.innerHeight / 2 - 158, zoom: 1 };
    }
    editCanvas(c => ({ ...c, nodes: [...c.nodes.map(n => ({ ...n, selected: false })), { ...node, selected: true }] }));
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault(); const kind = event.dataTransfer.getData('application/milver') || event.dataTransfer.getData('application/flowbench');
    if (availableTemplates.some(t => t.kind === kind)) addBlock(kind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };
  const updateBlock = (patch: Partial<BlockData>) => {
    if (!selected) return;
    editCanvas(c => ({ ...c, nodes: c.nodes.map(n => n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n) }));
  };
  const resize = (dimension: 'width' | 'height', value: number) => {
    if (!selected || value < (dimension === 'width' ? 120 : 90) || value > 2000) return;
    editCanvas(c => ({ ...c, nodes: c.nodes.map(n => n.id === selected.id ? { ...n, [dimension]: value } : n) }));
  };
  const mutateSelectedPorts = (transform: (n: BlockNode) => BlockNode) => {
    if (selected) editCanvas(c => ({ ...c, nodes: c.nodes.map(n => n.id === selected.id ? transform(n) : n) }));
  };
  const updatePort = (id: string, patch: Partial<Port>) => mutateSelectedPorts(n => {
    if (n.data.canvas) {
      const child = { ...n.data.canvas, nodes: n.data.canvas.nodes.map(b => b.id === id ? { ...b, data: { ...b.data, ...(patch.name !== undefined ? { label: patch.name } : {}), ...(patch.side ? { exposedSide: patch.side } : {}) } } : b) };
      return { ...n, data: { ...n.data, canvas: child, ports: interfacePorts(child) } };
    }
    return { ...n, data: { ...n.data, ports: n.data.ports.map(p => p.id === id ? { ...p, ...patch } : p) } };
  });
  const removePort = (id: string) => mutateSelectedPorts(n => {
    if (n.data.canvas) {
      const child = cleanEdges({ ...n.data.canvas, nodes: n.data.canvas.nodes.filter(b => b.id !== id) });
      return { ...n, data: { ...n.data, canvas: child, ports: interfacePorts(child) } };
    }
    return { ...n, data: { ...n.data, ports: n.data.ports.filter(p => p.id !== id) } };
  });
  const addPort = (type: Port['type']) => {
    const id = crypto.randomUUID();
    mutateSelectedPorts(n => {
      if (n.data.canvas) {
        const existing = n.data.canvas.nodes.filter(b => b.data.kind === (type === 'input' ? 'inport' : 'outport')).length;
        const boundary = makeNode(type === 'input' ? 'inport' : 'outport', { x: type === 'input' ? 0 : 560, y: 100 + existing * 160 }, id);
        boundary.data.label = `${type === 'input' ? 'Input' : 'Output'} ${existing + 1}`;
        const child = { ...n.data.canvas, nodes: [...n.data.canvas.nodes, boundary] };
        return { ...n, data: { ...n.data, canvas: child, ports: interfacePorts(child) } };
      }
      return { ...n, data: { ...n.data, ports: [...n.data.ports, { id, name: type === 'input' ? 'in' : 'out', type, side: type === 'input' ? 'left' : 'right' }] } };
    });
    setActivePort(id);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = structuredClone(selected); copy.id = crypto.randomUUID(); copy.position = { x: copy.position.x + 40, y: copy.position.y + 40 };
    editCanvas(c => ({ ...c, nodes: [...c.nodes.map(n => ({ ...n, selected: false })), copy] }));
  };
  const deleteSelection = () => {
    const ids = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (!ids.size && !edges.some(e => e.selected)) return;
    editCanvas(c => ({ ...c, nodes: c.nodes.filter(n => !ids.has(n.id)), edges: c.edges.filter(e => !e.selected) }));
  };
  const updateTheme = (patch: Partial<ThemeSettings>) => {
    snapshot(); replace({ ...documentRef.current, theme: { ...(documentRef.current.theme ?? defaultTheme), ...patch } });
  };
  const exportJson = () => {
    const blob = new Blob([serializeDiagram(documentRef.current)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a'); anchor.href = url;
    anchor.download = `${document.name.trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'milver'}.json`; anchor.click();
    URL.revokeObjectURL(url); notify('Diagram exported');
  };
  const importJson = (text: string) => {
    try { const next = parseDiagram(text); snapshot(); goTo([]); replace(next); setJsonOpen(false); setJsonError(''); notify('Diagram imported'); }
    catch (error) { setJsonError(error instanceof Error ? error.message : 'Invalid JSON'); }
  };
  const openJson = () => { setJson(serializeDiagram(documentRef.current)); setJsonError(''); setJsonOpen(true); };
  const openLibrary = () => setUI(u => ({ ...u, library: !u.library, ...(window.innerWidth < 700 && !u.library ? { inspector: false } : {}) }));
  const openInspector = () => { setAppearanceOpen(false); setUI(u => ({ ...u, inspector: !u.inspector, ...(window.innerWidth < 700 && !u.inspector ? { library: false } : {}) })); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="slider"]') || jsonOpen || helpOpen) return;
      const mod = event.metaKey || event.ctrlKey; const key = event.key.toLowerCase();
      if (mod && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (mod && key === 'd') { event.preventDefault(); duplicate(); }
      if (mod && key === 's') { event.preventDefault(); exportJson(); }
      if (!mod && key === 'v') setMode('select');
      if (!mod && key === 'h') setMode('pan');
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); deleteSelection(); }
      if (!mod && key === '1') void flow.fitView({ padding: 0.35, maxZoom: 1, duration: 200 });
      if (!mod && key === 'escape' && nested) goTo(path.slice(0, -1));
      if (!mod && key === '/') { event.preventDefault(); setUI(u => ({ ...u, library: true })); requestAnimationFrame(() => searchRef.current?.focus()); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  const filteredTemplates = availableTemplates.filter(t => `${t.label} ${t.description}`.toLowerCase().includes(search.toLowerCase()));
  const crumbs: { label: string; path: string[] }[] = [];
  for (let index = 0; index < path.length; index++) {
    const parent = canvasAt(document, path.slice(0, index)).nodes.find(n => n.id === path[index]);
    crumbs.push({ label: parent?.data.label ?? 'Parent block', path: path.slice(0, index + 1) });
  }

  return <TooltipProvider delayDuration={250}><BlockContext.Provider value={{ snapshot, enter }}><main className="milver-workspace" aria-label="milver block diagram editor">
    <ReactFlow<BlockNode>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onConnect={connect} isValidConnection={validConnection} onDrop={onDrop}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onNodeDragStart={snapshot} onSelectionDragStart={snapshot}
      onNodeClick={() => setActivePort(null)} onNodeDoubleClick={(_, node) => enter(node.id)}
      onPaneClick={() => setActivePort(null)}
      viewport={canvas.viewport} onViewportChange={viewport => {
        const current = canvasAt(documentRef.current, pathRef.current).viewport;
        if (current.x !== viewport.x || current.y !== viewport.y || current.zoom !== viewport.zoom) editCanvas(c => ({ ...c, viewport }), false);
      }}
      minZoom={0.15} maxZoom={2.5} snapToGrid={ui.snap} snapGrid={[20, 20]}
      panOnDrag={mode === 'pan' ? true : [1, 2]} selectionOnDrag={mode === 'select'} nodesDraggable={mode === 'select'}
      connectionLineType={ConnectionLineType.SmoothStep} colorMode={theme.mode}
      defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'var(--muted-foreground)' }, style: { stroke: 'var(--muted-foreground)', strokeWidth: 1.5 } }}
      deleteKeyCode={null} fitView={initial.fit} fitViewOptions={{ padding: 0.35, maxZoom: 1 }} proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="var(--grid-color)" gap={20} size={1}/>
      {ui.minimap && <MiniMap className="diagram-minimap" nodeColor="var(--primary)" maskColor="var(--background)" maskStrokeColor="var(--border)" pannable zoomable ariaLabel="Diagram overview"/>}
    </ReactFlow>

    <Card className="floating-island identity-island"><IconButton label={ui.library ? 'Collapse block library' : 'Open block library'} aria-expanded={ui.library} aria-controls="block-library" onClick={openLibrary}><Menu/></IconButton><Separator orientation="vertical"/><span className="wordmark">milver<span>.</span></span><span className="local-indicator" title={saved ? 'Saved locally' : 'Saving…'}><Check className={saved ? '' : 'saving'}/></span></Card>

    <Card className="floating-island tools-island" role="toolbar" aria-label="Canvas tools">
      <IconButton label="Select (V)" aria-pressed={mode === 'select'} variant={mode === 'select' ? 'secondary' : 'ghost'} onClick={() => setMode('select')}><MousePointer2/></IconButton>
      <IconButton label="Pan (H)" aria-pressed={mode === 'pan'} variant={mode === 'pan' ? 'secondary' : 'ghost'} onClick={() => setMode('pan')}><Hand/></IconButton><Separator orientation="vertical"/>
      <IconButton label="Undo" disabled={!history.past.length} onClick={undo}><Undo2/></IconButton><IconButton label="Redo" disabled={!history.future.length} onClick={redo}><Redo2/></IconButton><Separator orientation="vertical"/>
      <IconButton label="Snap to grid" aria-pressed={ui.snap} variant={ui.snap ? 'secondary' : 'ghost'} onClick={() => setUI(u => ({ ...u, snap: !u.snap }))}><Grid3X3/></IconButton>
    </Card>

    <Card className="floating-island actions-island" role="toolbar" aria-label="Diagram actions">
      <IconButton label="Import JSON" onClick={() => fileRef.current?.click()}><Upload/></IconButton><IconButton label="Export JSON" onClick={exportJson}><Download/></IconButton><IconButton label="JSON editor" onClick={openJson}><Braces/></IconButton><Separator orientation="vertical"/>
      <IconButton label="Appearance" aria-expanded={appearanceOpen} variant={appearanceOpen ? 'secondary' : 'ghost'} onClick={() => setAppearanceOpen(v => !v)}><Palette/></IconButton>
      <IconButton label={ui.inspector ? 'Collapse inspector' : 'Open inspector'} aria-expanded={ui.inspector} variant={ui.inspector && !appearanceOpen ? 'secondary' : 'ghost'} onClick={openInspector}><PanelRight/></IconButton>
    </Card>

    <Collapsible open={ui.library} className="left-panel-position" id="block-library"><CollapsibleContent><Card className="floating-panel library-panel" aria-label="Block library">
      <div className="panel-header"><h2>Block library</h2><Badge variant="secondary">{availableTemplates.length}</Badge><IconButton label="Close block library" onClick={() => setUI(u => ({ ...u, library: false }))}><X/></IconButton></div><Separator/>
      <div className="panel-scroll"><div className="library-document"><Label htmlFor="diagram-name">Diagram</Label><Input id="diagram-name" aria-label="Diagram name" value={document.name} onFocus={snapshot} onChange={e => replace({ ...documentRef.current, name: e.target.value })}/></div>
        <div className="library-search"><Search/><Input ref={searchRef} aria-label="Search blocks" placeholder="Search blocks…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>/</kbd></div>
        {nested && <div className="nested-library-note"><Network/><span>Input and Output blocks define<br/>this parent's external ports.</span></div>}
        <div className="palette-heading">{search ? 'Search results' : 'Blocks'}<span>Drag to canvas</span></div>
        <div className="palette-list">{filteredTemplates.map(t => <Button key={t.kind} variant="ghost" className="palette-block" draggable onDragStart={e => { e.dataTransfer.setData('application/milver', t.kind); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addBlock(t.kind)} title={`Drag ${t.label} onto the canvas, or click to add`}><span className="palette-glyph">{t.kind === 'subsystem' ? <Network/> : t.symbol}</span><span className="palette-copy"><strong>{t.label}</strong><small>{t.description}</small></span><GripVertical className="palette-grip"/></Button>)}</div>
        {!filteredTemplates.length && <p className="no-results">No matching blocks.</p>}
      </div>
      <Separator/><div className="library-footnote"><span className="port-indicator input"/>input<span className="port-indicator output"/>output<span>Drag to connect</span></div>
    </Card></CollapsibleContent></Collapsible>

    <div className="right-panel-position">{appearanceOpen ? <Appearance theme={theme} update={updateTheme} close={() => setAppearanceOpen(false)}/> : <Collapsible open={ui.inspector}><CollapsibleContent><Inspector node={selected} edge={selectedEdge} nodes={nodes} activePort={activePort} setActivePort={setActivePort} close={() => setUI(u => ({ ...u, inspector: false }))} update={updateBlock} resize={resize} updatePort={updatePort} removePort={removePort} addPort={addPort} enter={enter} duplicate={duplicate} remove={deleteSelection}/></CollapsibleContent></Collapsible>}</div>

    {nested && <Card className="floating-island breadcrumbs"><IconButton label="Back to parent canvas" onClick={() => goTo(path.slice(0, -1))}><ArrowLeft/></IconButton><Separator orientation="vertical"/><Button variant="ghost" size="sm" onClick={() => goTo([])}><Home/><span>{document.name || 'Root'}</span></Button>{crumbs.map((crumb, index) => <span key={crumb.path.join('/')} className="breadcrumb-item"><ChevronRight/><Button variant="ghost" size="sm" aria-current={index === crumbs.length - 1 ? 'page' : undefined} onClick={() => goTo(crumb.path)}>{crumb.label}</Button></span>)}</Card>}

    <Card className="floating-island bottom-left-island"><IconButton label="Help and shortcuts" onClick={() => setHelpOpen(true)}><CircleHelp/></IconButton><Separator orientation="vertical"/><span className="diagram-stats">{nodes.length} blocks<span>·</span>{edges.length} connections</span><span className="save-label">{saved ? 'Saved locally' : 'Saving…'}</span></Card>
    <Card className="floating-island zoom-island"><IconButton label="Zoom out" onClick={() => void flow.zoomOut({ duration: 150 })}><Minus/></IconButton><span className="zoom-value">{Math.round(canvas.viewport.zoom * 100)}%</span><IconButton label="Zoom in" onClick={() => void flow.zoomIn({ duration: 150 })}><Plus/></IconButton><Separator orientation="vertical"/><IconButton label="Fit to view (1)" onClick={() => void flow.fitView({ padding: 0.35, maxZoom: 1, duration: 200 })}><Expand/></IconButton><IconButton label="Toggle minimap" aria-pressed={ui.minimap} onClick={() => setUI(u => ({ ...u, minimap: !u.minimap }))}><Map/></IconButton></Card>
    <input className="sr-only" tabIndex={-1} ref={fileRef} type="file" accept=".json,application/json" aria-label="Import diagram file" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) { let text = ''; try { text = await file.text(); parseDiagram(text); importJson(text); } catch (error) { setJsonError(error instanceof Error ? error.message : 'Could not read JSON file'); setJson(text); setJsonOpen(true); } }
    }}/>

    <Dialog open={jsonOpen} onOpenChange={setJsonOpen}><DialogContent className="json-dialog"><DialogHeader><DialogTitle className="dialog-title"><Braces/>JSON editor</DialogTitle><DialogDescription>Edit the complete diagram, including nested canvases and theme. Apply to rebuild the workspace.</DialogDescription></DialogHeader><Textarea className="json-source" aria-label="Diagram JSON" value={json} onChange={e => setJson(e.target.value)} spellCheck={false}/>{jsonError && <p className="json-error" role="alert">{jsonError}</p>}<DialogFooter className="json-footer"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(json).then(() => notify('JSON copied'), () => notify('Clipboard unavailable. Select and copy the JSON.'))}><Copy/>Copy</Button><div><Button variant="outline" onClick={() => setJsonOpen(false)}>Cancel</Button><Button onClick={() => importJson(json)}><Check/>Apply to canvas</Button></div></DialogFooter></DialogContent></Dialog>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><DialogHeader><DialogTitle>Working with milver</DialogTitle><DialogDescription>Build diagrams, connect signals, and organize systems into nested canvases.</DialogDescription></DialogHeader><div className="shortcuts">{[['Select / pan', 'V / H'], ['Pan temporarily', 'Space + drag'], ['Zoom', 'Scroll / pinch'], ['Fit to view', '1'], ['Undo / redo', '⌘ Ctrl + Z / Shift + Z'], ['Duplicate', '⌘ Ctrl + D'], ['Delete selection', 'Delete'], ['Export JSON', '⌘ Ctrl + S'], ['Search blocks', '/'], ['Leave parent canvas', 'Esc']].map(([action, key]) => <div key={action}><span>{action}</span><kbd>{key}</kbd></div>)}</div><Separator/><p className="help-note">Select a block to resize it. Double-click a Parent block to enter its canvas. Add Input and Output blocks inside to define its external ports. This editor does not run numerical simulations.</p><a className="license-link" href="/xyflow-LICENSE.txt" target="_blank" rel="noreferrer">Third-party license notices<ArrowUpRight/></a></DialogContent></Dialog>
    {toast && <div className="editor-toast" role="status"><Check/>{toast}</div>}
  </main></BlockContext.Provider></TooltipProvider>;
}
export default function App() { return <ReactFlowProvider><Editor/></ReactFlowProvider>; }
