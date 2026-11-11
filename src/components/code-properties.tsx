import { completeFunction, insertFunctionSnippet, buildBlockModule } from '@/block-code';
import { CodeEditor } from './code-editor';
import { BlockHelp } from './block-help';
import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './editor-ui';
import { defaultModule, type BlockData, type BlockNode } from '@/model';
import { parseCodeFields, validVariable } from '@/code-config';

export function CodeProperties({ node, update }: { node: BlockNode; update: (patch: Partial<BlockData>) => void }) {
  const computation = !!node.data.operation;
  const python = node.data.kind === 'python';
  const raw = node.data.module ?? (python ? '' : defaultModule);
  const source = node.data.render !== undefined ? completeFunction(raw, 'run') : raw;
  const [draft, setDraft] = useState(source);
  const [mappings, setMappings] = useState<Record<string, string>>(() => Object.fromEntries(node.data.ports.map(p => [p.id, p.variable ?? ''])));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const file = useRef<HTMLInputElement>(null), binaryFile = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(source); setError(''); setNotice(''); }, [node.id, source]);
  const portKey = JSON.stringify(node.data.ports.map(p => [p.id, p.variable]));
  useEffect(() => setMappings(Object.fromEntries(node.data.ports.map(p => [p.id, p.variable ?? '']))), [node.id, portKey]);
  const commit = (patch: Partial<BlockData>) => {
    try { const data = { ...node.data, ...patch }; parseCodeFields(data, data.ports); if (data.render !== undefined) buildBlockModule(data.module ?? '', data.render); update(patch); setError(''); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
  };
  const readSource = async (file: File) => { if (file.size > 100000) throw new Error('Source files must be smaller than 100 KB.'); return file.text(); };
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  return <section className="property-section code-properties">
    <Field label={python ? 'Python source' : node.data.render !== undefined ? 'run()' : 'JavaScript ES module'}><CodeEditor label={python ? 'Python source' : 'JavaScript source'} language={python ? 'text' : 'javascript'} value={draft} onChange={setDraft}/></Field>
    <BlockHelp node={node} insert={snippet => setDraft(current => node.data.render !== undefined ? insertFunctionSnippet(current, snippet) : current + '\n\n' + snippet)}/>
    <div className="code-editor-actions"><Button size="sm" disabled={draft === source} onClick={() => { if (draft.length > 100000) { setError('Code exceeds 100 KB.'); return; } if (commit({ module: draft })) setNotice('Code applied.'); }}>Apply code</Button><Button variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp/>Import code</Button></div>
    <input hidden ref={file} type="file" accept={python ? '.py,.txt' : '.js,.mjs,.txt'} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { setDraft(await readSource(f)); setNotice('Code loaded. Apply code to save and run.'); setError(''); } catch (e) { fail(e); } }}/>
    <details className="code-bindings"><summary>Port variables</summary>    {computation ? <p className="field-help">Inputs are available by variable name and port ID. Return an object keyed by output variables, e.g. <code>return &#123; result: value &#125;</code>.</p> : <p className="field-help">Input variables are available as <code>inputs.name</code> and <code>variables.name</code>. Publish to an output variable with <code>emit(value, 'name')</code>. Port IDs also work.</p>}
    <div className="variable-mappings">{node.data.ports.map(p => <Field key={p.id} label={`${p.type === 'input' ? 'In' : 'Out'} · ${p.name} (${p.id})`}><Input aria-label={`Variable for ${p.id}`} value={mappings[p.id] ?? ''} placeholder={p.type === 'input' ? 'input1' : 'output1'} onChange={e => setMappings(current => ({ ...current, [p.id]: e.target.value }))}/></Field>)}</div>
    <Button variant="outline" size="sm" onClick={() => {
      try { const ports = node.data.ports.map(p => { const { variable: _variable, ...rest } = p; const variable = mappings[p.id]?.trim(); if (variable && !validVariable(variable)) throw new Error(`Invalid variable: ${variable}`); return { ...rest, ...(variable ? { variable } : {}) }; });
      if (commit({ ports })) setNotice('Port mappings applied.'); } catch (e) { fail(e); }
    }} onClickCapture={() => setError('')}>Apply mappings</Button>
</details>
    {computation ? <p className="field-help">Export <code>run(&#123; inputs, modules, state, parameters, tick &#125;)</code>. Libraries are available as <code>modules.alias</code>.</p> : python ? <p className="field-help">Python source is saved for your own runtime.</p> : <>
      <p className="field-help">{node.data.render !== undefined ? <>The run function has <code>inputs</code>, <code>state</code>, <code>value</code>, <code>modules</code>, <code>emit()</code> and <code>render()</code> in scope. Publish outputs with <code>emit(value, 'output1')</code>, then call <code>await render()</code>. State is saved in project JSON.</> : <>This block uses the original mount API. Its source is preserved for compatibility.</>}</p>
      <p className="field-help">Add shared packages in Libraries. Use <code>setProperty('label', 'Result')</code> or <code>setProperty('visuals.background', '#ffffff')</code> to control properties from code; those fields lock automatically. Use <code>onCleanup(fn)</code> to dispose timers or other logic resources.</p>
      {(node.data.recipe === 'WebAssembly' || node.data.wasm) && <><h3>WebAssembly binary</h3><p className="field-help">{node.data.wasm?.filename ?? 'No binary imported'}. The default wrapper calls a numeric exported function with inputs in port order. Customize the wrapper for memory, WASI or host imports.</p><Button variant="outline" size="sm" onClick={() => binaryFile.current?.click()}><FileUp/>Import .wasm</Button><input hidden ref={binaryFile} type="file" accept=".wasm" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { if (f.size > 1000000) throw new Error('Wasm files must be smaller than 1 MB.'); const bytes = new Uint8Array(await f.arrayBuffer()); const module = await WebAssembly.compile(bytes); const exports = WebAssembly.Module.exports(module).filter(e => e.kind === 'function'); if (!exports.length) throw new Error('The module needs an exported function.'); let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte); commit({ wasm: { filename: f.name, base64: btoa(raw), exportName: exports[0].name } }); } catch (e) { fail(e); } }}/><Field label="Exported function"><Input key={node.data.wasm?.filename} aria-label="Wasm exported function" defaultValue={node.data.wasm?.exportName ?? ''} onBlur={e => { if (node.data.wasm) commit({ wasm: { ...node.data.wasm, exportName: e.target.value } }); }}/></Field></>}
    </>}
    {error && <p className="code-error" role="alert">{error}</p>}{notice && <p className="field-help" role="status">{notice}</p>}
  </section>;
}
