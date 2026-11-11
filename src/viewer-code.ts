export const viewerLogic = `async function run() {
  // state.result: the complete input value; it is shared with render().
  state.result = inputs.input1 ?? inputs['in-0'] ?? null;
  await render();
}`;
export const viewerRender = `async function render() {
  // state.result: scalar, vector, matrix, tensor or another JSON value.
  // Change these defaults, or override them in Properties.
  const fontSize = renderer?.fontSize ?? 26;
  const precision = renderer?.precision ?? 4;
  const slice = renderer?.slice ?? 0;
  const view = describeValue(state.result, slice);
  if (view.error) {
    element.textContent = view.error;
    return;
  }
  if (view.kind === 'No signal') {
    element.textContent = 'Connect an input';
    return;
  }
  const format = value => formatValue(value, precision);
  if (!view.shape.length && view.kind !== 'Number') {
    element.textContent = format(state.result);
    element.style.font = '16px system-ui';
    return;
  }
  const tex = view.shape.length
    ? String.raw\`\\begin{bmatrix}\${view.rows.map(row => row.map(format).join(' & ')).join(String.raw\` \\\\ \`)}\\end{bmatrix}\`
    : format(view.rows[0]?.[0]);
  return latex(element, tex, { fontSize });
}`;
