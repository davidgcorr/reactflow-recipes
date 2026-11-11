import type { BlockNode } from '@/model';
import { Button } from './ui/button';
import { CircleHelp } from 'lucide-react';
export function BlockHelp({ node, insert, render = false }: { node: BlockNode; insert: (snippet: string) => void; render?: boolean }) {
  const input = node.data.ports.find(p => p.type === 'input');
  const variable = input?.variable ?? input?.id ?? 'input1';
  const snippets = render ? [
    ['React component', `return <div style={{ padding: 16 }}><strong>{String(state.result ?? '')}</strong></div>;`],
    ['LaTeX value', `latex(element, String(state.result ?? 0));`],
    ['Source button', `return <Button onClick={() => setValue(String(Number(value) + 1))}>Increment</Button>;`],
    ['Control appearance', `setProperty('visuals.background', '#f5f5f5');`],
  ] : [
    ['Read input and emit', `state.result = inputs[${JSON.stringify(variable)}] ?? 0;\nemit(state.result);\nawait render();`],
    ['Matrix product', `state.result = modules.tensorMath.matmul(inputs.input1, inputs.input2);\nemit(state.result);\nawait render();`],
    ['Attention', `state.result = modules.tensorMath.attention(inputs.input1, inputs.input2, inputs.input3);\nemit(state.result);\nawait render();`],
    ['Saved state', `state.calls = (state.calls ?? 0) + 1;\nawait render();`],
  ];
  return <details className="block-help"><Button asChild variant="ghost" size="sm"><summary><CircleHelp/>Block help & snippets</summary></Button><div className="block-help-body"><strong>{node.data.label}</strong><p>{node.data.description}</p><p><code>state</code> is shared and saved. <code>value</code> is the parameter string. Inputs: {node.data.ports.filter(p => p.type === 'input').map(p => `inputs[${JSON.stringify(p.variable ?? p.id)}]`).join(', ') || 'none'}. Outputs use <code>emit()</code>. Render also has React, Button, Slider, Select components, and <code>latex(element, tex)</code>.</p>{snippets.map(([title, code]) => <div key={title}><div className="snippet-heading"><span>{title}</span><Button size="xs" variant="outline" onClick={() => insert(code)}>Insert</Button></div><pre>{code}</pre></div>)}</div></details>;
}
