import { useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, FileUp, Plus, Trash2 } from 'lucide-react';
import { ProjectContext } from '@/project/context';
import { makeOperationBlock } from '@/project/blocks';
import { parseModules, parseOperation } from '@/project/schema';
import { operationPorts } from '@/project/blocks';
import { validVariable } from '@/code-config';
import type { BlockData, BlockNode } from '@/model';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Field, IconButton } from './editor-ui';

export function ProjectModules() {
  const { modules, catalog, createModule, loadExample, addBlock, removeModule } = useContext(ProjectContext);
  const file = useRef<HTMLInputElement>(null); const [error, setError] = useState('');
  return <Collapsible defaultOpen className="library-category project-modules"><CollapsibleTrigger className="category-toggle"><ChevronDown/><span>Project modules</span></CollapsibleTrigger><CollapsibleContent>
    <div className="module-toolbar"><Button variant="outline" size="sm" onClick={() => createModule()}><Plus/>New</Button><Button variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp/>Import JS</Button></div>
    <Button variant="ghost" size="sm" className="load-project-example" onClick={loadExample}>Open shared modules example</Button>
    <input hidden ref={file} type="file" accept=".js,.mjs" multiple onChange={async e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; try { for (const f of files) { if (f.size > 100000) throw new Error('Module exceeds 100 KB.'); createModule(await f.text(), f.name); } setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}/>
    {!modules.length && <p className="category-empty">Import once, use across all canvases.</p>}
    {modules.map(module => <details key={module.id} className="module-catalog" open><summary><code>{module.alias}</code><IconButton label={`Remove project module ${module.alias}`} size="icon-xs" onClick={e => { e.preventDefault(); removeModule(module.id); }}><Trash2/></IconButton></summary>{catalog.find(m => m.id === module.id)?.exports.map(entry => <div key={entry.name} className="module-export"><Button variant="ghost" size="sm" title={`Add ${entry.kind} block`} onClick={() => addBlock(makeOperationBlock(module, entry, { x: 0, y: 0 }))}><span className="export-kind">{entry.kind === 'class' ? 'new' : entry.kind === 'function' ? 'ƒ' : 'v'}</span><span>{entry.name}</span><Plus/></Button>{entry.kind === 'class' && <div className="module-methods">{entry.methods.map(method => <Button key={method.name} size="sm" variant="ghost" onClick={() => addBlock(makeOperationBlock(module, entry, { x: 0, y: 0 }, method))}>{method.name}()</Button>)}<Button size="sm" variant="ghost" onClick={() => addBlock(makeOperationBlock(module, entry, { x: 0, y: 0 }, undefined, 'value'))}>Read property…</Button></div>}</div>) ?? <p className="category-empty">Run the project to discover exports.</p>}</details>)}
    {error && <p className="code-error" role="alert">{error}</p>}
  </CollapsibleContent></Collapsible>;
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
