# milver

A collection of reusable block, mask, connection, and nested-canvas recipes for future projects. The focus is on exploring and extending functionality.

A React + TypeScript block-diagram editor built with React Flow and actual [shadcn/ui](https://ui.shadcn.com/) components. The canvas fills the browser; controls and independently collapsible panels float above it.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` creates `dist/`, `npm run preview` serves the production build, and `npm test` runs the model tests.

## GitHub Pages deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs tests and builds the app on pull requests and pushes to `main`. After a successful build on `main`, it deploys `dist/` to GitHub Pages. You can also run it manually from the Actions tab with `main` selected. Pull requests only run validation.

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source ([Vite deployment guide](https://vite.dev/guide/static-deploy#github-pages)). Once this workflow is pushed to `main` and succeeds, the app will be available at <https://davidgcorr.github.io/reactflow-recipes/>. The workflow uses the built-in GitHub token; no personal access token or deployment secret is needed.

The deployment build sets Vite's base URL to the repository path, so scripts, styles, and public links work under `/reactflow-recipes/`. Local development keeps its default root path. To check the Pages build locally:

```sh
npm run build -- --base /reactflow-recipes/
npm run preview
```

Open `http://localhost:4173/reactflow-recipes/`.

## Workspace

- The project title can be edited beside the milver wordmark at the top left.
- The top-left button opens/closes the floating block library. The **Blocks** tab starts with Sources, followed by Operators & functions, JavaScript, Sinks and Structure. Tiles preview input and output ports. **My Blocks** separates Saved blocks, Block examples and Project examples. The **Libraries** tab manages project-wide JavaScript packages without creating canvas blocks. Selecting a block or wire opens the inspector; deselecting minimizes it. The top-right panel button also opens/closes it. Drag the left edge of the right panel to resize it; the width is saved locally. Keyboard users can focus its separator and use the arrow keys.
- Canvas tools float at the bottom; the canvas hierarchy shows a home icon at the top and parent block names inside nested canvases. Import, export, and JSON editor use icon buttons with accessible labels and tooltips.
- Drag a block from the library to place it. Clicking a library item adds a block near the viewport center. Double-click a JavaScript block to use its controls; click outside it to return to dragging.
- Drag blocks to move them; moving a block hides the inspector. Select a block to reveal four corner resize handles. The inspector has **Properties** (names, values, descriptions, ports), **Render** (appearance and the render function), **Code** (logic, port mappings and runtime feedback), and **JSON** (editable block data) tabs.
- Block labels sit outside the bottom border. A subtle, divided type breadcrumb (for example, `gens › constant`) can be collapsed with its chevron and restored using the chevron on hover or **Render → Type breadcrumb**.
- Inputs and outputs can sit on the left, right, top, or bottom. Multiple ports on a side are evenly spaced. Hover over a port for one second, then drag the small grip beside it to move it along any border; drag the circular port itself to connect wires. Focus a grip and use arrow keys for fine adjustment. Ports magnetize to the center and evenly spaced positions on their destination border. Port names appear only while hovering over that port. Custom positions, including parent interfaces, are saved in JSON and used in exports. Move a port and its connections follow it.
- Ports use concentric circles: outputs have a filled core, inputs have hollow blue rings. Drag an output to an input to connect them. Outputs can fan out; each input accepts one connection. Connections between different blocks can form feedback loops.
- Scroll or pinch to zoom. Hold Space and drag, use the middle/right mouse button, or choose the hand tool to pan. Drag the background in selection mode to select multiple blocks.
- Edits are saved locally in your browser. Export a JSON file for a portable copy. The importer reads the previous recipe's version-1 diagrams; previous local data is migrated without deleting the old storage entry.

## Parent blocks and nested canvases

1. Add a **Parent block** from the library. It starts with an internal Input → Gain → Output example.
2. **Double-click** it to enter its own canvas. The inspector's Enter canvas button and the block's arrow also enter it.
3. Add **Input** and **Output** interface blocks from the library inside the parent. These entries appear only inside nested canvases.
4. Rename an interface block to name the parent's external port. Choose **Side on parent** to position that port on the left, right, top, or bottom.
5. Connect an Input block's output to the internal system; connect the internal system to an Output block's input.
6. Return using the breadcrumb, back arrow, or Escape. The parent exposes exactly the interfaces defined inside it.

Input and Output markers inside a parent are compact 28 × 28 ports, with a small handle and an external name. Larger legacy interface blocks migrate to the compact size without changing port IDs or wiring. Inputs and outputs remain synchronized in both directions: editing a parent's port name/side updates its internal interface block. Adding a parent's port creates the corresponding interface block inside. Deleting either removes its internal and external incident connections. Parents can contain further parents, up to 16 levels. Each canvas keeps an independent viewport. Undo/redo includes nested edits and restores the relevant canvas.

`examples/parent-block.json` contains a complete connected nested controller you can import. `examples/two-blocks.json` is a minimal flat example.

## shadcn theme

The first workspace uses a black-and-white Neutral palette. Open the palette icon to change Light/Dark mode, choose a preset, tune **OKLCH hue and chroma**, or change corner radius. Chroma 0 is monochrome. Canvas customization also includes a saved **Rough mode** switch and **Roughness** slider (0–3) for hand-drawn block outlines and arrows (including publication exports), a grid switch and Plain, Aurora, Ocean and Sunset backgrounds. `theme.rough`, `theme.roughness`, `theme.showGrid` and `theme.canvasBackground` are saved in diagram JSON alongside the theme. Blocks, ports, floating panels, dialogs, and controls share the same semantic CSS variables. Legacy per-block `data.color` remains in JSON for compatibility. `data.visuals` optionally overrides theme fill and ink and controls header, label, mask content, port labels, dimensions and radius. Use **Use theme colors** to clear fill and ink overrides.

The official shadcn CLI generated the components in `src/components/ui/`. Radix provides keyboard interactions, focus management, dialogs, collapsibles, selects, tooltips, and sliders. `components.json` configures future shadcn additions. `src/theme.ts` maps theme settings to semantic tokens.

## JSON ↔ UI

`src/model.ts` defines the versioned schema, templates, validation, serialization, and immutable canvas updates. A diagram contains `version: 1`, `name`, `nodes`, `edges`, `viewport`, and optional `theme` and `modules`.

Each block has `id`, `type: "block"`, `position`, `width`, `height`, and `data` with its label, kind, description, display value, legacy color, and ports. A port has `id`, `name`, `type: "input" | "output"`, and `side: "left" | "right" | "top" | "bottom"`. Edges refer to node IDs and port IDs through `source`, `sourceHandle`, `target`, and `targetHandle`.

Parent blocks use `data.kind: "subsystem"` and `data.canvas: { nodes, edges, viewport }`. Their external ports correspond to `inport` and `outport` nodes in the child canvas:

- The parent's port ID equals its interface block's node ID.
- Its port name equals the interface block's `data.label`.
- Its side comes from the interface block's `data.exposedSide`.
- An `inport` exposes a parent input but has one output inside the canvas.
- An `outport` exposes a parent output but has one input inside the canvas.

Import validates all nested canvases, interface consistency, connections, dimensions, IDs, viewport values, and theme settings before replacing anything. Limits are 2,000 total blocks, 10,000 total connections, and 16 nested levels. Invalid imports leave the existing diagram untouched. Selection and measured DOM sizes are excluded from JSON at every nesting level.

Theme example:

```json
{ "mode": "light", "hue": 0, "chroma": 0, "radius": 10 }
```

`canvasAt`, `updateCanvas`, `makeNode`, `serializeDiagram`, and `parseDiagram` are reusable independently from the editor.

## Publishing exports

Use the download icon at the top right to open the export dialog. JSON remains available there, and Cmd/Ctrl+S still exports the editable JSON source.

| Format | Publishing use |
| --- | --- |
| HTML | A self-contained, read-only interactive viewer. Pan, zoom, and navigate parent blocks. Works offline or in an iframe. |
| SVG | Real vector paths, shapes, and text; no HTML foreignObject, screenshots, external stylesheets, or network dependencies. |
| PNG | A high-resolution raster image, with optional transparent background. |
| GIF | A 24-frame, 1.92-second looping connection illustration, or a still GIF when animation is off. |
| JSON | The complete editable system and theme, for reopening in milver. |

**Current canvas** exports every block at the current level, including blocks outside the visible viewport. **Entire system** includes every nested canvas: HTML makes them navigable, while images arrange them vertically as labeled sheets. HTML defaults to Entire system. Static SVG and PNG exports show each canvas's blocks and connections; parent internals appear on their own sheet when Entire system is selected.

Image exports support an optional title and dot grid. PNG and SVG can have a transparent page background; blocks keep their theme fill. PNG width options range from 800 to 4096 pixels. GIF width is capped at 1600 pixels, uses a solid background and a palette of up to 256 colors, and animates moving dots on connections for illustration, not numerical simulation. GIFs without connections export as a still image. Raster exports preserve aspect ratio; very large systems are scaled to stay within 8192 pixels in height and a 16-megapixel PNG / 2-megapixel GIF budget. The dialog shows the actual resulting dimensions.

All formats use the diagram's shadcn theme. Selection borders, resize handles, editor panels, toolbars, and minimap are excluded. Image framing is independent of editor pan and zoom. Text uses standard system fonts, with no external font downloads.

After a download, **Copy embed** provides either an `<img>` tag for an image or an `<iframe>` tag for HTML. Upload the file to your own website and replace `src` with its published path. For example:

```html
<img src="/diagrams/system.svg" alt="System diagram" style="max-width:100%;height:auto" loading="lazy">
<iframe src="/diagrams/system.html" title="System diagram" width="100%" height="600" style="border:0" loading="lazy"></iframe>
```

The HTML viewer opens parent blocks by double-clicking or by focusing them and pressing Enter/Space. Breadcrumbs and Escape return to the parent. Each level retains its pan and zoom during viewing. It embeds all graphics, styles, scripts, and license notices into a single file; no React, CDN, account, or server application is needed. Websites that strip scripts can use SVG, PNG, or GIF instead.

Exporting downloads files locally; it does not publish or upload anything. Export rendering lives in `src/export/scene.ts`, HTML viewing in `src/export/html.ts`, browser encoding in `src/export/download.ts`, and the shadcn dialog in `src/components/export-dialog.tsx`.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select / pan tool | V / H |
| Temporarily pan | Space + drag |
| Fit canvas | 1 |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z |
| Duplicate selection | Cmd/Ctrl+D |
| Delete selection | Delete / Backspace |
| Export JSON | Cmd/Ctrl+S |
| Leave parent canvas | Escape |

Shortcuts do not run while typing in fields or using a dialog, select, or slider.

## Attribution

React Flow is MIT licensed. The application hides its on-canvas badge using `proOptions.hideAttribution` and retains the copyright and permission notice in `THIRD_PARTY_NOTICES.txt` and the production asset `THIRD_PARTY_NOTICES.txt`, linked from Help. The maintainers request supporting the project through React Flow Pro when removing the badge; see their [attribution guidance](https://reactflow.dev/remove-attribution).

The editor uses the official `@xyflow/react` package from [xyflow/xyflow](https://github.com/xyflow/xyflow). A reference checkout was fetched to `/tmp/reactflow-recipes-xyflow-reference` during initial development.

This is a diagram editor, not a numerical simulation engine. Constants, gains, sums, and JavaScript recipes provide live value previews. Integrators and other simulation placeholders do not simulate a numerical system.

## Project libraries

Open **Libraries** in the left panel to add an ES module URL, upload `.js`/`.mjs` files, or create an embedded module. Expand an imported library to edit its alias, URL or source; use its trash button to remove it. These edits support undo/redo. Importing a library never creates a block or any connections.

Libraries are exposed to every mounted JavaScript block, including its render function, as `modules.alias`. For example, a library saved as `helper` with `export const double = x => x * 2` is available as `modules.helper.double(x)`. Embedded libraries can import each other by project alias. The block’s code can also use dynamic imports for project aliases. Remote libraries must be browser-compatible ESM with CORS support. Uploaded source is embedded in JSON; remote URLs require network access.

## JavaScript logic and rendering

**JavaScript → Module** creates a block with two complete editable functions. The lifecycle adapter is supplied by the editor.

**Code** controls inputs, state and outputs:

```js
async function run() {
  state.result = modules.tensorMath.multiply(inputs.input1 ?? Number(value), 2);
  emit(state.result, 'output1');
  await render();
}
```

**Render** controls the block content:

```js
async function render() {
  element.textContent = String(state.result);
  element.style.font = '24px system-ui';
}
```

Both functions can access `inputs`, `variables`, `state`, `value`, `modules`, and `setProperty`. `inputs` contains port IDs and named aliases; expand **Port variables** in Code to change the mappings. `emit(value, outputIdOrVariable)` defaults to the first output. `emitEvent(value, port)` publishes a distinct event even when its payload is unchanged. Outputs and state accept bounded JSON values, including numeric arrays and shaped tensors; functions, cycles, NaN and oversized values are rejected. Positive and negative infinity are supported.

The Code and Render editors use CodeMirror with JavaScript/JSX highlighting, indentation, search, code folding, and editor undo/redo. Expand an editor for more space; open **Block help & snippets** for the current block’s variables and insertable examples.

`state` is shared between logic and rendering and persisted as `data.state`, including nested edits. Code and render source are stored as `data.module` and `data.render`. Runtime inputs, outputs and errors appear in Code. Block JSON updates the UI after validation; UI changes update the same JSON. The project JSON editor also exposes library definitions, geometry, nested canvases and connections.

Use `setProperty('label', 'Result')`, `setProperty('width', 280)` or `setProperty('visuals.background', '#ffffff')` to change the block itself. Supported fields are label, description, value, width, height and every appearance setting. The editor validates changes and records ownership in `data.controlledProperties`. Matching UI controls and resize handles lock automatically. Remove the code assignment and release the field in Render to resume UI editing. Ownership survives JSON export/import.

Render also supports JSX using bundled React and the same shadcn/Radix components as the editor. No external package import is needed:

```jsx
// state.config contains { label, count }; clicks save a new parameter and rerun Code.
return <Button variant="outline" onClick={() =>
  setValue(JSON.stringify({ ...state.config, count: (state.config.count ?? 0) + 1 }))
}>
  {state.config.label} · {state.config.count ?? 0}
</Button>;
```

`Slider`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` and `React` are also in scope. The default Slider, Selector and Button sources use these components. Numeric sources call `latex(element, tex)` using bundled KaTeX and accessible MathML, so numbers, vectors, matrices and tensor slices work offline. Stock render functions document their state fields, precision, slice selection and styling points.

Return a cleanup function from Render to dispose graphics, observers or event listeners before the next render or unmount. Use `onCleanup(fn)` in Code for logic resources such as timers. Render can retain DOM elements between calls; use `element.replaceChildren()` when a complete redraw is appropriate.

**Sources** includes Number, Boolean, String, Vector, Matrix, Tensor, Clock, Trigger, Slider, Selector and Button. Their logic and render bodies use the same API. `setValue(string)` saves a source parameter; source controls use it for slider positions, selector choices and button counts. Clock periods are milliseconds (minimum 16 ms). Trigger counts rising input edges.

**My Blocks → Block examples** contains Three.js and LaTeX examples with graphics in Render. Three.js registers its required package in Libraries; LaTeX uses the bundled renderer. The Three.js example needs WebGL. **WebAssembly** starts with a working two-input integer add binary. Import another `.wasm` file in Code and choose the exported function. The binary, wrapper logic and rendering all round-trip through JSON.

JavaScript blocks run in opaque-origin iframes with `sandbox="allow-scripts"`. They cannot access the editor DOM or its local storage. Library namespaces are shared within a block’s logic and rendering, while each iframe has its own library instances. Custom JavaScript runs while its canvas is mounted; hiding mask content leaves the runtime mounted. Publication exports show static labels; JSON preserves executable code and configuration.

**Math / value viewer** is the single numeric/value sink. It now uses the same editable `run()` and `render()` functions as other math blocks. Tune the LaTeX, font size, precision, slice selection, colors or JSX layout in Render; the source and saved state travel in JSON. Older viewer nodes receive the default functions when loaded. It accepts scalars, vectors, nested matrices/tensors, older shaped tensors, and runtime preview metadata. It uses LaTeX for numeric data and text for other values. Choose precision, formula font size and tensor slice in Properties. Scope and Python are no longer offered in the palette; older saved projects remain readable.

## Reusable blocks, operators and sinks

Use **Save to My Blocks** in a JavaScript block’s inspector to capture its name, dimensions, parameter, ports, saved state, logic, rendering and project libraries. Insert a saved block to create an independent instance with a fresh ID. Deleting a saved definition leaves placed instances intact. Definitions live in `diagram.myBlocks` and travel with JSON and project undo/redo. Aliases with conflicting library definitions are reported before insertion.

**Operators & functions** includes Gain (scalar or tensor scaling), matrix multiplication, addition/residuals, elementwise multiplication/scaling, dot/cross products, transpose, reshape, tensor contraction, softmax, GELU, layer normalization, linear projection and scaled dot-product attention. Adding a numeric source or operator registers the bundled TensorFlow.js runtime if needed. Its code calls `modules.tensorMath`, a stable facade around TensorFlow.js tensor operations; `modules.tf` exposes the low-level API. Custom project libraries keep their aliases. Unconnected ports use the example defaults in Parameter. The CPU backend is bundled for offline execution in sandboxed frames and workers. It uses float32 computation and disposes temporary tensors after each operation. The facade supports broadcasting, batched/vector matrix products, stable softmax, normalization and optional causal attention.

Open **My Blocks → Project examples** for **Attention · step by step** ([JSON](examples/attention-step-by-step.json)) or **Transformer forward pass** ([JSON](examples/transformer-forward.json)). Both expose Q Kᵀ → scale by 1/√dₖ → row-wise softmax → multiply by V → multiply by W₀. The full example also includes token embeddings, explicit Q/K/V weight matrices, residuals, layer normalization and a two-layer feed-forward network with GELU. Weights are editable Matrix sources; biases are in the Linear block parameters. These are small, untrained, single-head examples. `node scripts/create-transformer-example.mjs` regenerates both from the stock blocks.

**Sinks** includes one Math / value viewer, a line graph and a scatter plot. The line graph accepts a numeric vector or retains the last 128 scalar values. The scatter plot accepts `[[x,y], ...]` pairs and displays up to 256 points. Graph state and editable SVG/JSX rendering round-trip through JSON.

Numeric sources use Python-style list notation: `[1,2,3]`, `[[1,2],[4,5]]`, or `[[[1,2]],[[3,4]]]`. A small parser accepts these lists (including trailing commas and `inf`, `-inf`, `Infinity` or `∞` tokens), checks rectangular shape and numeric values, and converts them to temporary TensorFlow.js tensors. Ports and saved state carry plain nested arrays, so every source, operator and viewer uses the same transferable format. Earlier `{shape, data}` inputs are still understood. In a numeric block’s Render function, change `const fontSize = 24` to tune formula size.

Canvas Ctrl/Cmd+C copies all selected blocks and their internal connections; Ctrl/Cmd+V pastes independent copies with new IDs, preserving nested parent interfaces and library definitions. Browser clipboard access has an in-app fallback. Text/code editors keep their usual clipboard behavior.

The Libraries panel includes reference cards for React, shadcn/ui, KaTeX and TensorFlow.js. Project JSON records the numeric runtime as `{ "builtin": "tensorflow", "referenceUrl": "https://www.tensorflow.org/js" }`; it does not embed the large compiled dependency. Importing JSON restores the same bundled CPU implementation.

TensorFlow.js was chosen for editable model construction and tensor operations ([tensor/operation guide](https://www.tensorflow.org/js/guide/tensors_operations)). ONNX Runtime Web is a strong alternative for executing existing ONNX models ([documentation](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)); Transformers.js targets pretrained model pipelines. This editor needs individual operations that users can wire into a forward model.

## Existing project compatibility

Saved version-1 diagrams continue to load. Existing JavaScript blocks without `data.render` retain their `export default function mount(...)` lifecycle and embedded dependencies. Their Code tab identifies this API. New blocks save complete `async function run() { ... }` and `async function render() { ... }` declarations. Earlier body-only source is adapted when shown in the editor and remains executable.

Older Import module, function, constructor, method, property and JS computation nodes remain supported when loaded from JSON; they are no longer generated from library imports. [`examples/shared-modules.json`](examples/shared-modules.json) demonstrates this earlier shared worker API, including live class instances, nested interface routing, and Run/Step execution. Its computation code exports `run({ inputs, modules, state, parameters, tick })`. That worker state and live instances are transient; the new JavaScript block state is saved explicitly in `data.state`.

`npm run dev` and `npm run build` generate the isolated worker bundle from `src/project/worker.ts`. Restart the dev command after editing worker source.

## Connection recipes

Select a connection to choose **Orthogonal** or **Bézier curve**, stroke color and width, and **None**, **Moving dashes**, or **Travelling pulse** animation. Travel time and reverse flow are configurable per connection. Double-click a wire to insert a waypoint near that segment; select the wire to drag its points. Double-click a point to remove it, or use **Reset waypoints**. Orthogonal routing retains square-axis segments with rounded corners; Bézier routing passes smoothly through the waypoints.

`src/connections.ts` shares route geometry between the editor and publication exports. Exported SVG/PNG/HTML/GIF use the chosen routing and basic block appearance. Programmable masks are represented by a static “JS module” label in publication exports; JSON retains the executable source. The publication GIF's existing global flow animation remains independent of editor animation settings.

Infinity example: `[[2,-inf,0],[0,2,0],[0,0,1]]`. Infinity remains numeric through TensorFlow operations, sandbox messages, saved state, clipboard and JSON import/export, and renders as ∞. Because JSON has no infinity literal, saved values use the reserved tagged form `{ "$number": "-Infinity" }` or `{ "$number": "Infinity" }`. Undefined arithmetic that produces NaN is reported as an error rather than being saved as null.
