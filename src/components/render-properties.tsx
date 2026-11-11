import { CodeEditor } from './code-editor';
import { BlockHelp } from './block-help';
import { buildBlockModule } from '@/block-code';
import { useEffect, useState } from 'react';
import { defaultRender } from '@/block-code';
import { type BlockData, type BlockNode } from '@/model';
import { Button } from './ui/button';
import { Field } from './editor-ui';
import { VisualProperties } from './visual-properties';

export function RenderProperties({ node, update, resize }: { node: BlockNode; update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void }) {
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(node.data.render ?? defaultRender);
  useEffect(() => setDraft(node.data.render ?? defaultRender), [node.id, node.data.render]);
  return <><VisualProperties node={node} update={update} resize={resize}/>{node.data.kind === 'javascript' && <section className="property-section">
    {node.data.render !== undefined ? <><h3>Render function</h3><p className="field-help">Called by <code>await render()</code> in Code. Read or update <code>state</code>, draw into <code>element</code>, and use packages through <code>modules.alias</code>. Return JSX using React and shadcn components, or draw directly into element. Return a cleanup function for animations or listeners.</p>
    <Field label="render()"><CodeEditor label="Render function source" value={draft} onChange={setDraft}/></Field>
    <BlockHelp node={node} render insert={snippet => setDraft(current => current + '\n\n' + snippet)}/>
    {error && <p className="code-error" role="alert">{error}</p>}
    <Button size="sm" disabled={draft === node.data.render || draft.length > 100000} onClick={() => { try { buildBlockModule(node.data.module ?? '', draft); update({ render: draft }); setError(''); } catch (e) { setError(String(e)); } }}>Apply render</Button></> : <p className="field-help">This saved block draws through its original mount function in Code.</p>}
  </section>}</>;
}
