import { CodeEditor } from './code-editor';
import { useContext, useEffect, useRef, useState } from 'react';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { ProjectContext } from '@/project/context';
import { parseModules, parseOperation } from '@/project/schema';
import { operationPorts } from '@/project/blocks';
import { validVariable } from '@/code-config';
import type { BlockData, BlockNode } from '@/model';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, IconButton } from './editor-ui';

export function ProjectModules() {
  const { modules, createModule, updateModule, removeModule } = useContext(ProjectContext);
  const file = useRef<HTMLInputElement>(null);
  const [alias, setAlias] = useState('helper'), [url, setUrl] = useState(''), [error, setError] = useState('');
  const attempt = (action: () => void) => { try { action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  return <section className="project-libraries">
    <div className="library-intro"><h3>JavaScript Libraries</h3><p>Import once. Use in any JavaScript block’s code or render function through <code>modules.alias</code>.</p></div>
    <div className="library-import-form"><Field label="Library alias"><Input aria-label="Library alias" value={alias} onChange={e => setAlias(e.target.value)}/></Field>
    <Field label="ES module URL"><Input aria-label="Library URL" placeholder="https://esm.sh/package@version" value={url} onChange={e => setUrl(e.target.value)}/></Field>
    <div className="module-toolbar"><Button size="sm" onClick={() => attempt(() => { if (!url.trim()) throw new Error('Enter an ES module URL.'); if (!validVariable(alias)) throw new Error('Enter a JavaScript alias.'); createModule('', alias, url); setUrl(''); })}><Plus/>Add URL</Button><Button variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp/>Import JS</Button><Button variant="ghost" size="sm" onClick={() => attempt(() => createModule('export const example = 42;', alias))}>New</Button></div>
    <input hidden ref={file} type="file" accept=".js,.mjs" multiple onChange={async e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; try { for (const f of files) { if (f.size > 100000) throw new Error('Module exceeds 100 KB.'); createModule(await f.text(), f.name); } setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}/></div>
    <details className="builtin-library"><summary>Included libraries</summary><div className="builtin-library-cards">{[
      ['React', 'JSX rendering and component state', 'https://react.dev'],
      ['shadcn/ui', 'Button, Slider and Select components', 'https://ui.shadcn.com'],
      ['Radix UI', 'Accessible control primitives', 'https://www.radix-ui.com'],
      ['KaTeX', 'Accessible mathematical typesetting', 'https://katex.org'],
      ['TensorFlow.js', 'Tensor operations · bundled CPU backend · modules.tensorMath / modules.tf', 'https://www.tensorflow.org/js'],
    ].map(([name,description,url]) => <a key={name} className="builtin-library-card" href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{description}</span><small>{url}</small></a>)}</div></details>
    <div className="library-list-heading"><span>Project scope</span><span>{modules.length} imported</span></div>
    {!modules.length && <div className="library-empty">No libraries yet.<p>Add an ES module URL or upload JavaScript to get started.</p></div>}
    {modules.map(module => <LibraryEditor key={module.id} module={module} save={next => attempt(() => updateModule(next))} remove={() => removeModule(module.id)}/>)}
    {error && <p className="code-error" role="alert">{error}</p>}
  </section>;
}
function LibraryEditor({ module, save, remove }: { module: import('@/project/schema').ProjectModule; save: (module: import('@/project/schema').ProjectModule) => void; remove: () => void }) {
  const [alias, setAlias] = useState(module.alias), [content, setContent] = useState(module.url ?? module.source ?? '');
  useEffect(() => { setAlias(module.alias); setContent(module.url ?? module.source ?? ''); }, [module]);
  if (module.builtin) return <div className="library-entry builtin-project-library"><div className="section-heading"><strong>{module.alias} · TensorFlow.js</strong><IconButton label={`Remove library ${module.alias}`} size="icon-xs" onClick={remove}><Trash2/></IconButton></div><p>Bundled tensor operations; nested arrays in and out.</p><a href={module.referenceUrl} target="_blank" rel="noreferrer">{module.referenceUrl}</a></div>;
  return <details className="library-entry"><summary><span className="library-entry-icon">JS</span><span><strong>{module.alias}</strong><small>{module.url ? new URL(module.url).hostname : module.filename ?? 'Embedded module'}</small></span><IconButton label={`Remove library ${module.alias}`} size="icon-xs" onClick={e => { e.preventDefault(); remove(); }}><Trash2/></IconButton></summary><div className="library-entry-body">
    <code>modules.{module.alias}</code><Field label="Alias"><Input aria-label={`Alias for ${module.alias}`} value={alias} onChange={e => setAlias(e.target.value)}/></Field>
    <Field label={module.url ? 'Module URL' : 'Module source'}>{module.url ? <Input aria-label={`URL for ${module.alias}`} value={content} onChange={e => setContent(e.target.value)}/> : <CodeEditor label={`Source for ${module.alias}`} value={content} onChange={setContent}/>}</Field>
    <Button size="sm" disabled={alias === module.alias && content === (module.url ?? module.source)} onClick={() => save({ ...module, alias, ...(module.url ? { url: content } : { source: content }) })}>Apply library</Button>
  </div></details>;
}
export function ProjectModuleProperties({ node, update }: { node: BlockNode; update: (patch: Partial<BlockData>) => void }) {
  const { modules, updateModule } = useContext(ProjectContext);
  const module = modules.find(m => m.id === node.data.projectModuleId);
  const [alias, setAlias] = useState(module?.alias ?? ''), [source, setSource] = useState(module?.source ?? ''), [url, setUrl] = useState(module?.url ?? ''), [remote, setRemote] = useState(!!module?.url), [error, setError] = useState('');
  useEffect(() => { setAlias(module?.alias ?? ''); setSource(module?.source ?? ''); setUrl(module?.url ?? ''); setRemote(!!module?.url); setError(''); }, [module]);
  return <section className="property-section"><h3>Shared module</h3><Field label="Project module"><select aria-label="Project module" value={node.data.projectModuleId ?? ''} onChange={e => update({ projectModuleId: e.target.value })}><option value="" disabled>Choose module</option>{modules.map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></Field>{module && <>
    <Field label="Alias"><Input aria-label="Project module alias" value={alias} onChange={e => setAlias(e.target.value)}/></Field><label className="visibility-option"><span>Load from URL</span><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)}/></label>
    {remote ? <Field label="Browser ES module URL"><Input aria-label="Project module URL" value={url} onChange={e => setUrl(e.target.value)}/></Field> : <Field label="Shared module source"><Textarea className="module-editor" aria-label="Shared module source" spellCheck={false} value={source} onChange={e => setSource(e.target.value)}/></Field>}
    <Button size="sm" onClick={() => { try { const next = { id: module.id, alias: alias.trim(), ...(module.filename ? { filename: module.filename } : {}), ...(module.dependencies ? { dependencies: module.dependencies } : {}), ...(remote ? { url: url.trim() } : { source }) }; parseModules(modules.map(m => m.id === module.id ? next : m)); updateModule(next); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>Apply shared module</Button>
    <p className="field-help">Exports are available project-wide in JS computations via <code>modules.{module.alias}</code>. Import another project alias directly in this module, e.g. <code>import &#123; fn &#125; from 'helper'</code>. Use absolute URLs for remote packages. Applying module code resets live instances.</p>
  </>}{error && <p role="alert" className="code-error">{error}</p>}</section>;
}
export function OperationProperties({ node, update }: { node: BlockNode; update: (patch: Partial<BlockData>) => void }) {
  const { modules } = useContext(ProjectContext), operation = node.data.operation!;
  const [args, setArgs] = useState(node.data.ports.filter(p => p.type === 'input' && !['object', 'trigger'].includes(p.id)).map(p => p.variable ?? p.name).join(', ')), [error, setError] = useState('');
  return <section className="property-section"><h3>Shared computation</h3>
    {!['method', 'property', 'code'].includes(operation.type) && <><Field label="Project module"><select aria-label="Operation module" value={operation.moduleId ?? ''} onChange={e => update({ operation: { ...operation, moduleId: e.target.value } })}><option value="" disabled>Choose module</option>{modules.map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></Field><Field label="Export name"><Input aria-label="Export name" defaultValue={operation.exportName ?? ''} onBlur={e => { try { const op = { ...operation, exportName: e.target.value.trim() }; parseOperation(op); update({ operation: op }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}/></Field></>}
    {(operation.type === 'method' || operation.type === 'property') && <Field label="Instance member"><Input aria-label="Instance member" defaultValue={operation.member ?? ''} onBlur={e => { try { const op = { ...operation, member: e.target.value.trim() }; parseOperation(op); update({ operation: op }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}/></Field>}
    <Field label="Execution"><select aria-label="Computation execution" value={operation.effect} onChange={e => update({ operation: { ...operation, effect: e.target.value as typeof operation.effect } })}><option value="pure">Live / pure</option><option value="step">On Run / Step, or trigger</option><option value="event">Only on trigger</option></select></Field>
    {operation.type !== 'export' && <><Field label="Argument variables (comma separated)"><Input aria-label="Argument variables" value={args} onChange={e => setArgs(e.target.value)}/></Field><Button size="sm" variant="outline" onClick={() => { try { const names = args.split(',').map(n => n.trim()).filter(Boolean); if (names.length > 32 || names.some(n => !validVariable(n) || ['object', 'trigger', 'done'].includes(n)) || new Set(names).size !== names.length) throw new Error('Use up to 32 unique JavaScript variable names.'); parseOperation(operation); update({ ports: operationPorts(operation.type, names) }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>Apply argument ports</Button></>}
    {operation.type === 'code' && <Field label="Module aliases used (empty means all)"><Input aria-label="Module aliases used" defaultValue={operation.uses?.join(', ') ?? ''} onBlur={e => { try { const op = { ...operation, uses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; parseOperation(op); update({ operation: op }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}/></Field>}
    <p className="field-help">{operation.type === 'code' ? 'Edit run({ inputs, modules, state, parameters, tick }) in Code. State persists until Reset.' : 'Arguments use input ports in order. The Parameter field accepts a JSON array of defaults for unconnected arguments.'} Connect done → trigger to sequence method calls. Same-object outputs preserve the instance. Independent ready blocks run in stable ID order.</p>
    {error && <p role="alert" className="code-error">{error}</p>}
  </section>;
}
