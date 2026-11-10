import { useEffect, useRef, useState } from 'react';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, IconButton } from './editor-ui';
import { defaultModule, type BlockData, type BlockNode } from '@/model';
import { parseCodeFields, validVariable } from '@/code-config';

export function CodeProperties({ node, update }: { node: BlockNode; update: (patch: Partial<BlockData>) => void }) {
  const python = node.data.kind === 'python';
  const source = node.data.module ?? (python ? '' : defaultModule);
  const [draft, setDraft] = useState(source);
  const [mappings, setMappings] = useState<Record<string, string>>(() => Object.fromEntries(node.data.ports.map(p => [p.id, p.variable ?? ''])));
  const [alias, setAlias] = useState('helper');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lineNumbers = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null), dependencyFile = useRef<HTMLInputElement>(null), binaryFile = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(source); setError(''); setNotice(''); }, [node.id, source]);
  const portKey = JSON.stringify(node.data.ports.map(p => [p.id, p.variable]));
  useEffect(() => setMappings(Object.fromEntries(node.data.ports.map(p => [p.id, p.variable ?? '']))), [node.id, portKey]);
  const commit = (patch: Partial<BlockData>) => {
    try { const data = { ...node.data, ...patch }; parseCodeFields(data, data.ports); update(patch); setError(''); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
  };
  const readSource = async (file: File) => { if (file.size > 100000) throw new Error('Source files must be smaller than 100 KB.'); return file.text(); };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  return <section className="property-section code-properties">
    <h3>Port variables</h3><p className="field-help">Input variables are available as <code>inputs.name</code> and <code>variables.name</code>. Publish to an output variable with <code>emit(value, 'name')</code>. Port IDs also work.</p>
    <div className="variable-mappings">{node.data.ports.map(p => <Field key={p.id} label={`${p.type === 'input' ? 'In' : 'Out'} · ${p.name} (${p.id})`}><Input aria-label={`Variable for ${p.id}`} value={mappings[p.id] ?? ''} placeholder={p.type === 'input' ? 'input1' : 'output1'} onChange={e => setMappings(current => ({ ...current, [p.id]: e.target.value }))}/></Field>)}</div>
    <Button variant="outline" size="sm" onClick={() => {
      try { const ports = node.data.ports.map(p => { const { variable: _variable, ...rest } = p; const variable = mappings[p.id]?.trim(); if (variable && !validVariable(variable)) throw new Error(`Invalid variable: ${variable}`); return { ...rest, ...(variable ? { variable } : {}) }; });
      if (commit({ ports })) setNotice('Port mappings applied.'); } catch (e) { fail(e); }
    }} onClickCapture={() => setError('')}>Apply mappings</Button>
    <Field label={python ? 'Python source' : 'JavaScript ES module'}><div className="code-editor"><div className="code-line-numbers" ref={lineNumbers} aria-hidden="true">{draft.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div><Textarea className="module-editor" aria-label={python ? 'Python source' : 'JavaScript source'} spellCheck={false} wrap="off" onScroll={e => { if (lineNumbers.current) lineNumbers.current.scrollTop = e.currentTarget.scrollTop; }} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const input = e.currentTarget; const start = input.selectionStart; setDraft(draft.slice(0, start) + '  ' + draft.slice(input.selectionEnd)); requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 2; }); } }}/></div></Field>
    <div className="code-editor-actions"><Button size="sm" disabled={draft === source} onClick={() => { if (draft.length > 100000) { setError('Code exceeds 100 KB.'); return; } if (commit({ module: draft })) setNotice('Code applied.'); }}>Apply code</Button><Button variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp/>Import code</Button></div>
    <input hidden ref={file} type="file" accept={python ? '.py,.txt' : '.js,.mjs,.txt'} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { setDraft(await readSource(f)); setNotice('Code loaded. Apply code to save and run.'); setError(''); } catch (e) { fail(e); } }}/>
    {python ? <p className="field-help">Python source and mappings are stored in JSON. Python does not execute in this editor.</p> : <>
      <p className="field-help">Export <code>default function mount(&#123; element, inputs, variables, value, emit, setValue, modules, wasm &#125;)</code>. Return <code>&#123; update(inputs, value, variables), destroy() &#125;</code>. Use <code>setValue(string)</code> to save source controls.</p>
      <h3>Modules</h3><p className="field-help">Use normal URL imports in code, or add dependencies below. Import them by their bare specifier, such as <code>import &#123; fn &#125; from 'helper'</code>, or use <code>modules.helper</code>. URLs need CORS. Uploaded dependencies should use these same bare specifiers for each other.</p>
      <Field label="Module specifier"><Input aria-label="Module specifier" value={alias} onChange={e => setAlias(e.target.value)}/></Field>
      <Field label="ES module URL"><Input aria-label="ES module URL" placeholder="https://…/module.js" value={url} onChange={e => setUrl(e.target.value)}/></Field>
      <div className="code-editor-actions"><Button variant="outline" size="sm" onClick={() => { if (commit({ dependencies: [...(node.data.dependencies ?? []), { specifier: alias.trim(), url: url.trim() }] })) { setUrl(''); setNotice('Module added.'); } }}><Plus/>Add URL</Button><Button variant="outline" size="sm" onClick={() => dependencyFile.current?.click()}><FileUp/>Import module</Button></div>
      <input hidden ref={dependencyFile} type="file" accept=".js,.mjs" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { const source = await readSource(f); if (commit({ dependencies: [...(node.data.dependencies ?? []), { specifier: alias.trim(), source }] })) setNotice('Module source embedded in JSON.'); } catch (e) { fail(e); } }}/>
      <div className="module-dependencies">{node.data.dependencies?.map((d, i) => <div key={d.specifier}><div><code>{d.specifier}</code><small>{d.url ?? 'Embedded module source'}</small></div><IconButton label={`Remove module ${d.specifier}`} onClick={() => commit({ dependencies: node.data.dependencies!.filter((_, j) => j !== i) })}><Trash2/></IconButton></div>)}</div>
      {(node.data.recipe === 'WebAssembly' || node.data.wasm) && <><h3>WebAssembly binary</h3><p className="field-help">{node.data.wasm?.filename ?? 'No binary imported'}. The default wrapper calls a numeric exported function with inputs in port order. Customize the wrapper for memory, WASI or host imports.</p><Button variant="outline" size="sm" onClick={() => binaryFile.current?.click()}><FileUp/>Import .wasm</Button><input hidden ref={binaryFile} type="file" accept=".wasm" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { if (f.size > 1000000) throw new Error('Wasm files must be smaller than 1 MB.'); const bytes = new Uint8Array(await f.arrayBuffer()); const module = await WebAssembly.compile(bytes); const exports = WebAssembly.Module.exports(module).filter(e => e.kind === 'function'); if (!exports.length) throw new Error('The module needs an exported function.'); let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte); commit({ wasm: { filename: f.name, base64: btoa(raw), exportName: exports[0].name } }); } catch (e) { fail(e); } }}/><Field label="Exported function"><Input key={node.data.wasm?.filename} aria-label="Wasm exported function" defaultValue={node.data.wasm?.exportName ?? ''} onBlur={e => { if (node.data.wasm) commit({ wasm: { ...node.data.wasm, exportName: e.target.value } }); }}/></Field></>}
    </>}
    {error && <p className="code-error" role="alert">{error}</p>}{notice && <p className="field-help" role="status">{notice}</p>}
  </section>;
}
