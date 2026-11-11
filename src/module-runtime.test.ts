import { sandbox } from './test-utils/module-sandbox';
import { describe, expect, it } from 'vitest';
import { buildBlockModule } from './block-code';

describe('state snapshots crossing the sandbox boundary', () => {
  it('emits nested matrices read back from observed state without DataCloneError', async () => {
    const run = await sandbox(buildBlockModule(`state.result = inputs.signal;
emit(state.result, 'result');
await render();`, `element.textContent = JSON.stringify(state.result);`));
    await run.send('0', [[1, 1], [0, 10]]);
    expect(run.messages.filter(m => m.type === 'mask-error')).toEqual([]);
    expect(run.messages).toContainEqual({ type: 'mask-output', token: 'session', port: 'out-0', value: [[1, 1], [0, 10]] });
    expect(run.element.textContent).toBe('[[1,1],[0,10]]');
    run.dispose();
  });
  it('snapshots nested state aliases and event payloads as detached JSON', async () => {
    const run = await sandbox(buildBlockModule(`state.matrix = inputs.signal;
state.saved = { matrix: state.matrix };
state.matrix[0][0] += 1;
emit(state.saved, 'result');
emitEvent(state.matrix, 'result');
await render();`, `element.textContent = JSON.stringify(state.saved);`));
    await run.send('0', [[1,2],[3,4]]);
    expect(run.messages.filter(m => m.type === 'mask-error')).toEqual([]);
    expect(run.messages).toContainEqual({ type: 'mask-state', token: 'session', state: { matrix: [[2,2],[3,4]], saved: { matrix: [[2,2],[3,4]] } } });
    expect(run.messages).toContainEqual({ type: 'mask-output', token: 'session', port: 'out-0', value: { matrix: [[2,2],[3,4]] } });
    expect(run.messages).toContainEqual({ type: 'mask-output', token: 'session', port: 'out-0', value: [[2,2],[3,4]], event: true });
    run.dispose();
  });
});

describe('sandbox module bridge', () => {
  it('loads embedded visual dependencies, maps named ports and publishes structured output', async () => {
    const run = await sandbox(`export default function mount({variables,emit,modules,element,setValue}){element.textContent='ready';emit([modules.helper.double(variables.signal)],'result');setValue('saved');return {update(inputs,value,variables){emit([variables.signal],'result')}};}`, [{ specifier: 'helper', source: 'export const double=x=>x*2;' }]);
    expect(run.messages[0]).toMatchObject({ type: 'mask-ready', token: 'session' });
    await run.send('1', 4);
    expect(run.messages).toContainEqual({ type: 'mask-output', token: 'session', port: 'out-0', value: [8] });
    expect(run.messages).toContainEqual({ type: 'mask-value', token: 'session', value: 'saved' });
    await run.send('2', 7);
    expect(run.messages.at(-1)).toMatchObject({ port: 'out-0', value: [7] });
    run.dispose();
  });
  it('publishes distinct events even when their payloads are equal', async () => {
    const run = await sandbox('export default function mount({emitEvent}) { emitEvent(true); emitEvent(true); }');
    await run.send('1');
    expect(run.messages.filter(m => m.type === 'mask-output')).toEqual([{ type: 'mask-output', token: 'session', port: 'out-0', value: true, event: true }, { type: 'mask-output', token: 'session', port: 'out-0', value: true, event: true }]);
  });
  it('disposes failed updates and remounts correctly after fixing the parameter', async () => {
    const run = await sandbox(`export default function mount({element,value,emit}){function update(inputs,value){if(value==='bad')throw new Error('bad parameter');element.textContent=value;emit(Number(value));}update({},value);return {update,destroy(){element.textContent='disposed'}};}`);
    await run.send('1'); expect(run.element.textContent).toBe('1');
    await run.send('bad'); expect(run.messages.at(-1).type).toBe('mask-error');
    await run.send('2'); expect(run.element.textContent).toBe('2'); expect(run.messages.at(-1)).toMatchObject({ type: 'mask-output', value: 2 });
    run.dispose();
  });
  it('rejects NaN output and reports compilation failures', async () => {
    const run = await sandbox('export default function mount({emit}) { emit(NaN); }');
    await run.send('1'); expect(run.messages.at(-1).type).toBe('mask-error');
    expect(run.messages.some(m => m.type === 'mask-output')).toBe(false);
    const broken = await sandbox('export default broken syntax'); expect(broken.messages.at(-1).type).toBe('mask-error');
  });
});

describe('split logic and render functions', () => {
  it('shares project packages, named inputs and persistent state with render', async () => {
    const run = await sandbox(buildBlockModule(`state.count = (state.count ?? 0) + 1;
state.result = modules.math.double(inputs.signal);
emit(state.result, 'result');
setProperty('label', 'Computed');
await render();`, `element.textContent = state.count + ': ' + modules.math.double(state.result);`), [{ specifier: 'math', source: 'export const double = x => x * 2;' }], { count: 4 });
    await run.send('0', 3);
    expect(run.element.textContent).toBe('5: 12');
    expect(run.messages).toContainEqual({ type: 'mask-output', token: 'session', port: 'out-0', value: 6 });
    expect(run.messages).toContainEqual({ type: 'mask-state', token: 'session', state: { count: 5, result: 6 } });
    expect(run.messages).toContainEqual({ type: 'mask-property', token: 'session', path: 'label', value: 'Computed' });
    await run.send('0', 7);
    expect(run.element.textContent).toBe('6: 28');
    // An unchanged input must not execute the logic again when state is saved.
    await run.send('0', 7);
    expect(run.element.textContent).toBe('6: 28');
    run.dispose();
  });
  it('runs render and logic cleanup before updates and disposal', async () => {
    const run = await sandbox(buildBlockModule(`onCleanup(() => emit('logic-cleanup'));
await render();`, `element.textContent = value;
return () => emit('render-cleanup');`));
    await run.send('a');
    await run.send('b');
    expect(run.element.textContent).toBe('b');
    expect(run.messages.filter(m => m.type === 'mask-output').map(m => m.value)).toEqual(['logic-cleanup', 'render-cleanup']);
    run.dispose();
    await new Promise(resolve => setImmediate(resolve));
    expect(run.messages.filter(m => m.type === 'mask-output').map(m => m.value)).toEqual(['logic-cleanup', 'render-cleanup', 'logic-cleanup', 'render-cleanup']);
  });
  it('reports errors thrown by render and recovers after a parameter edit', async () => {
    const run = await sandbox(buildBlockModule('await render();', `if (value === 'bad') throw new Error('render failed');
element.textContent = value;`));
    await run.send('bad');
    expect(run.messages.at(-1)).toMatchObject({ type: 'mask-error', error: 'render failed' });
    await run.send('fixed');
    expect(run.element.textContent).toBe('fixed');
    run.dispose();
  });
});
