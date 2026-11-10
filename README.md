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
- The top-left button opens/closes the floating block library. Collapsible Generators & datatypes, JavaScript code blocks, and Python code blocks categories show compact icon tiles. Python blocks store editable source for a consuming runtime; Python does not execute in this editor. Selecting a block or wire opens the inspector; deselecting minimizes it. The top-right panel button also opens/closes it. Each panel also has its own close button.
- Canvas tools float at the bottom; the canvas hierarchy shows a home icon at the top and parent block names inside nested canvases. Import, export, and JSON editor use icon buttons with accessible labels and tooltips.
- Drag a block from the library to place it. Clicking a library item adds a block near the viewport center.
- Drag blocks to move them; moving a block hides the inspector. Select a block to reveal four corner resize handles. The inspector has **Properties** (names, values, descriptions, ports), **Visuals** (fill, ink, dimensions, radius, visibility), and **Code** (JavaScript/Python source, port mappings, module imports) tabs.
- Block labels sit outside the bottom border. A subtle, divided type breadcrumb (for example, `gens › constant`) can be collapsed with its chevron and restored using the chevron on hover or **Visuals → Type breadcrumb**.
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

Inputs and outputs remain synchronized in both directions: editing a parent's port name/side updates its internal interface block. Adding a parent's port creates the corresponding interface block inside. Deleting either removes its internal and external incident connections. Parents can contain further parents, up to 16 levels. Each canvas keeps an independent viewport. Undo/redo includes nested edits and restores the relevant canvas.

`examples/parent-block.json` contains a complete connected nested controller you can import. `examples/two-blocks.json` is a minimal flat example.

## shadcn theme

The first workspace uses a black-and-white Neutral palette. Open the palette icon to change Light/Dark mode, choose a preset, tune **OKLCH hue and chroma**, or change corner radius. Chroma 0 is monochrome. Theme settings are saved and included in diagram JSON. Blocks, ports, floating panels, dialogs, and controls share the same semantic CSS variables. Legacy per-block `data.color` remains in JSON for compatibility. `data.visuals` optionally overrides theme fill and ink and controls header, label, mask content, port labels, dimensions and radius. Use **Use theme colors** to clear fill and ink overrides.

The official shadcn CLI generated the components in `src/components/ui/`. Radix provides keyboard interactions, focus management, dialogs, collapsibles, selects, tooltips, and sliders. `components.json` configures future shadcn additions. `src/theme.ts` maps theme settings to semantic tokens.

## JSON ↔ UI

`src/model.ts` defines the versioned schema, templates, validation, serialization, and immutable canvas updates. A diagram contains `version: 1`, `name`, `nodes`, `edges`, `viewport`, and optional `theme`.

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

## Shared project modules and computation blocks

Open **Project modules → New** to create a shared module, or **Import JS** to upload one or more `.js`/`.mjs` files. The Import module block's Properties lets you edit its alias and source or switch to an absolute ES module URL. Functions, classes, methods, and constants appear in the project module catalog after loading. Click an export to create its visual block. A module's exports are shared across the root canvas and every nested canvas.

For a working example, select **Open shared modules example** in the library, or import [`examples/shared-modules.json`](examples/shared-modules.json). It demonstrates matrix multiplication (17, 39), code using the same shared library (42), and an accumulator passed by reference through a nested canvas. **Step** advances it from 10 to 15, then 20, then 25. Opening the example is undoable.

The project execution toolbar provides Live/Pause, Run once, Step, Stop, and Reset. Run once and Step each evaluate one graph tick, including eligible stateful operations. Live recomputes changed pure values; it does not repeat untriggered state mutations. Methods default to execution on Run/Step or trigger. Connect `done` → `trigger` to order operations; chain the `same object` output to pass the same instance. Independent ready blocks execute in stable ID order, so use explicit connections when ordering matters. Constructor blocks retain their instance until constructor arguments change or the project runtime resets.

Argument ports are configurable in **Properties → Argument variables**. The Parameter field accepts a JSON array of defaults for unconnected arguments. Functions use positional arguments; constructors use the same mapping. Method/property blocks require an object connection. Property names are editable. The catalog discovers export names and methods; APIs with default/rest/destructured arguments may require explicit port configuration. An optional exported `milver` object can supply argument hints:

```js
export function add(a, b) { return a + b; }
export class Counter {
  constructor(initial = 0) { this.value = initial; }
  increment(amount) { this.value += amount; return this.value; }
}
export const PI = Math.PI;
export const milver = {
  add: { args: ['a', 'b'] },
  Counter: { args: ['initial'], methods: { increment: { args: ['amount'] } } }
};
```

**JS computation** blocks use the same registry and runtime as visual calls. They have a Code tab with input/output variable mappings and source import:

```js
export async function run({ inputs, modules, state, parameters, tick }) {
  state.calls = (state.calls ?? 0) + 1;
  return { result: modules.math.add(inputs.a, inputs.b) };
}
```

Return an object keyed by output variables, or a value for a single output. `state` survives invocations until Reset. Select On Run/Step or trigger for code that mutates state; Pure code may be cached. Parameters are parsed JSON. Set **Module aliases used** to declare dependencies, or leave it empty to expose all project aliases. Normal source imports may also reference project aliases. Shared computation code runs without a DOM; existing DOM masks use their separate `mount` API.

Modules are evaluated once per runtime generation. Uploaded files are embedded in JSON, and sibling relative imports (for example `./helpers.js`) resolve using their saved filenames. Remote ES modules and their relative imports need CORS. Literal dynamic imports work; expression-based dynamic imports and circular local module graphs currently report a loading error. Browser-compatible ESM is supported, rather than arbitrary Node.js packages. The loader fetches remote dependencies without credentials. Pin remote versions or embed source when reproducibility/offline use matters.

Class instances, functions, typed arrays, and large tensors remain in the shared worker. Connections pass actual values/references inside that runtime, preserving prototypes and identity. The canvas receives bounded previews (at most 32 × 32 cells per tensor slice), metadata, timings, and errors. Ordinary JSON serialization does not save live instances, closures, tensors, or optimizer state; rebuilding a saved project reconstructs its runtime. Explicit model checkpoints/GPU backends are future work. Structural/code/module edits restart the runtime; layout, title, selection, and visual edits preserve its instances.

The runtime worker is hosted by an opaque-origin sandboxed frame, outside the editor's DOM/storage context. Stop terminates the worker even if user code is stuck in a synchronous loop; a subsequent Run starts a fresh runtime. Project blocks share one trust boundary. Network access is available to module code, so this is not a network-denial sandbox. The current opaque worker is a CPU/Wasm execution baseline; access to secure-context APIs such as WebGPU requires further work. Existing standalone diagrams continue to open without project modules.

Native datatype/source recipes can feed shared computations even inside hidden nested canvases. Edited/custom DOM masks still execute only while their canvas is mounted; use JS computation blocks for project-wide execution. Custom mask code can publish distinct equal-payload triggers through `emitEvent(value, port)`, while ordinary `emit` publishes value changes.

`npm run dev` and `npm run build` generate the isolated worker bundle from `src/project/worker.ts`. Restart the dev command after editing worker source so its generated bundle is refreshed. Project imports, operations, aliases, argument mappings, source, and nested wiring all round-trip through diagram JSON and undo/redo; execution values and UI interaction state remain transient.

## Programmable JS masks

The library contains **JavaScript datatypes** (Number, Boolean, String, Vector, Matrix, Tensor), **JavaScript sources** (Clock, Trigger, Slider, Selector, Button), and **JavaScript code blocks** (DOM, LaTeX, Three.js, WebAssembly). Select a block and open **Code** to edit source, import a `.js`/`.mjs` file, map ports to named variables, or add module dependencies. Python uses the same source editor and stores code without executing it.

Drag a code block by its header or mask to move it; click to select it. Click the pointer icon at the bottom right of a JavaScript block to operate a slider, selector, button, or custom mask; click its checkmark to return to dragging. The icon stays at 30% opacity until hovered or keyboard-focused. The small header chevron collapses the type breadcrumb. Snap guides appear while a port is magnetized to an alignment position.

```js
export default function mount({ element, inputs, variables, value, emit, setValue, modules }) {
  function update(inputs, value, variables) {
    // Map an input to "signal" and an output to "result" in Code.
    const signal = variables.signal ?? Number(value);
    element.textContent = `Value: ${signal}`;
    emit(Number(signal) * 2, 'result');
  }
  update(inputs, value, variables);
  return { update, destroy() { /* dispose graphics/listeners here */ } };
}
```

`inputs` includes original port IDs and their variable aliases; `variables` contains named inputs. `emit(value, outputIdOrVariable)` publishes an output, defaulting to the first output port. Modules may emit bounded JSON values: finite numbers, strings, booleans, null, arrays, and objects (including `{shape: [2,2], data: [1,2,3,4]}` tensors). Cycles, functions, nonfinite numbers, and oversized signals are rejected. The Properties tab shows live inputs and outputs.

`setValue(string)` updates the block's saved parameter. Slider positions, selector choices, and button click counts use it, so they survive reload, JSON export/import, and undo/redo. Clock periods are milliseconds (minimum 16 ms); clocks emit successive tick counts and dispose their timers when removed. Trigger counts false-to-true input transitions. Clock ticks and other emitted signal values are transient; they are not stored as execution state.

A module can return a cleanup function or `{ update(inputs, value, variables), destroy() }`. Without `update`, changes dispose and remount the mask. The opaque-origin iframe uses `sandbox="allow-scripts"` and cannot access the editor DOM or local storage. Hiding mask content keeps its runtime mounted. Standalone mask previews operate in the current canvas. Shared computation projects execute nested interfaces through the project runtime; uncontrolled feedback cycles report an error.

**Module imports:** use normal absolute URL `import` statements in code, or add an ES module URL / upload module source under **Code → Modules**. Visual dependencies are exposed both through browser [import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) (for example, `import { fn } from 'helper'`) and `modules.helper`. Use bare specifiers when embedded modules import each other. Uploaded source is embedded in diagram JSON and works offline; remote URLs need network access and CORS. The DOM recipe works offline. Three.js requires WebGL; the [KaTeX](https://katex.org/docs/api) and [Three.js](https://threejs.org/manual/pages/creating-a-scene.html) recipes fetch their libraries remotely.

**WebAssembly:** the block starts with a working two-input integer `add` module. Import a `.wasm` file in Code and choose its exported function. Binary bytes, filename, wrapper source, port mappings, and exported function are saved in JSON. The default wrapper uses [WebAssembly.instantiate](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiate_static) and calls a numeric function with inputs in port order. Edit the wrapper for memory-based APIs, host imports, WASI, or non-numeric interfaces; there is no automatic WASI environment.

**Value renderer:** connect a number, vector, matrix, nested numeric array, or shaped tensor. Scalars display as numbers, vectors and matrices as tables, and tensors as 2D slices. In Properties, choose decimal precision and a zero-based slice index. Large tables show up to 32 rows and 32 columns per slice. Display settings are saved; live input values remain transient.

Import [`examples/javascript-workbench.json`](examples/javascript-workbench.json) for connected matrix, slider, clock, and WebAssembly examples. The Wasm example adds 6 and 7 and displays 13. Publication exports retain static block labels; executable code, dependencies, binary modules, mappings, and renderer settings are retained in JSON.

## Connection recipes

Select a connection to choose **Orthogonal** or **Bézier curve**, stroke color and width, and **None**, **Moving dashes**, or **Travelling pulse** animation. Travel time and reverse flow are configurable per connection. Double-click a wire to insert a waypoint near that segment; select the wire to drag its points. Double-click a point to remove it, or use **Reset waypoints**. Orthogonal routing retains square-axis segments with rounded corners; Bézier routing passes smoothly through the waypoints.

`src/connections.ts` shares route geometry between the editor and publication exports. Exported SVG/PNG/HTML/GIF use the chosen routing and basic block appearance. Programmable masks are represented by a static “JS module” label in publication exports; JSON retains the executable source. The publication GIF's existing global flow animation remains independent of editor animation settings.
