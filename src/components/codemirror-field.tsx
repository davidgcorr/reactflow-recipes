import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
export default function CodeMirrorField({ value, onChange, label, language }: { value: string; onChange: (value: string) => void; label: string; language: 'javascript' | 'json' | 'text' }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null);
  const change = useRef(onChange); change.current = onChange;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, doc: value, extensions: [basicSetup, keymap.of([indentWithTab]), language === 'javascript' ? javascript({ jsx: true }) : language === 'json' ? json() : [], EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }), EditorView.updateListener.of(update => { if (update.docChanged) change.current(update.state.doc.toString()); }), EditorView.theme({ '&': { fontSize: '12px', backgroundColor: 'var(--background)', color: 'var(--foreground)' }, '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, monospace', overflow: 'auto', minHeight: '260px', maxHeight: '65vh' }, '.cm-content': { padding: '12px 0' }, '.cm-gutters': { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', border: 'none' }, '.cm-activeLine': { backgroundColor: 'var(--muted)' }, '.cm-activeLineGutter': { backgroundColor: 'var(--secondary)' }, '.cm-cursor': { borderLeftColor: 'var(--foreground)' } })] });
    view.current = editor; setMounted(true);
    return () => { editor.destroy(); view.current = null; };
  }, [language, label]);
  useEffect(() => { const editor = view.current; if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } }); }, [value]);
  return <div ref={host}><textarea aria-label={label} hidden={mounted} value={value} onChange={e => onChange(e.target.value)}/></div>;
}
