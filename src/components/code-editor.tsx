import { RenderBoundary } from './render-boundary';
import { lazy, Suspense, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
const CodeMirrorField = lazy(() => import('./codemirror-field'));

export function CodeEditor({ value, onChange, label, language = 'javascript', expandable = true }: { value: string; onChange: (value: string) => void; label: string; language?: 'javascript' | 'json' | 'text'; expandable?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="source-editor"><div className="source-editor-bar"><span>{language === 'javascript' ? 'JavaScript / JSX' : language.toUpperCase()}</span>{expandable && <Button size="icon-xs" variant="ghost" aria-label={`Expand ${label}`} onClick={() => setExpanded(true)}><Maximize2/></Button>}</div><RenderBoundary resetKey={label} fallback={<textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)}/>}><Suspense fallback={<textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)}/>}><CodeMirrorField value={value} onChange={onChange} label={label} language={language}/></Suspense></RenderBoundary>{expandable && <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="expanded-code-dialog"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader><CodeEditor value={value} onChange={onChange} label={`Expanded ${label}`} language={language} expandable={false}/></DialogContent></Dialog>}</div>;
}
