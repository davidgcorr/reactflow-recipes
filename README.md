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
- Drag blocks to move them; moving a block hides the inspector. Select a block to reveal four corner resize handles. The inspector has **Logic** (names, values, descriptions, ports) and **Visuals** (fill, ink, dimensions, radius, visibility, and module source) tabs.
- Block labels sit outside the bottom border. A subtle, divided type breadcrumb (for example, `gens › constant`) can be collapsed by clicking it and restored using the chevron on hover or **Visuals → Type breadcrumb**.
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

This is a diagram editor, not a numerical simulation engine. The block presets do not execute calculations or fabricate signal results.

## Programmable JS masks

Add **JS module** from the library, then select **Visuals**. Choose a DOM, LaTeX, or Three.js recipe, edit the source, and click **Apply module**. The module renders inside the block mask, in an iframe with `sandbox="allow-scripts"` and an opaque origin. It cannot access the editor DOM or local storage. CDN imports require an internet connection; the DOM recipe works offline. Three.js requires WebGL. The LaTeX recipe uses [KaTeX](https://katex.org/docs/api); the 3D recipe follows [Three.js scene setup](https://threejs.org/manual/pages/creating-a-scene.html).

```js
export default function mount({ element, inputs, value, emit }) {
  function update(inputs, value) {
    const x = Number(inputs['in-0'] ?? value);
    element.textContent = `Value: ${x}`;
    emit(x * 2, 'out-0');
  }
  update(inputs, value);
  return { update, destroy() { /* dispose graphics/listeners here */ } };
}
```

`element` is the mask container. `inputs` maps input port IDs to scalar values (number, string, boolean or null); `value` is the block's fallback parameter string. `emit(value, outputPortId)` updates an output (`out-0` by default). The Logic tab shows live input/output values; expanded port properties show IDs. A module can return a cleanup function, or an object with `update(inputs, value)` and `destroy()`. Without an update method, input changes dispose and mount the mask again. ResizeObserver is available for graphics that need to follow block size.

The preview layer in `src/runtime.ts` propagates constants, gains, signed sums, and emitted JS outputs within the current canvas. Unsupported operations, disconnected inputs and feedback signals stay null. There is no time stepping, integration, or evaluation across parent boundaries. This layer is deliberately small so consuming projects can supply their own runtime. Module source, visuals, and connection options survive save/load, JSON export, and undo/redo. Emitted values are transient. Hiding mask content keeps the module mounted.

## Connection recipes

Select a connection to choose **Orthogonal** or **Bézier curve**, stroke color and width, and **None**, **Moving dashes**, or **Travelling pulse** animation. Travel time and reverse flow are configurable per connection. Double-click a wire to insert a waypoint near that segment; select the wire to drag its points. Double-click a point to remove it, or use **Reset waypoints**. Orthogonal routing retains square-axis segments with rounded corners; Bézier routing passes smoothly through the waypoints.

`src/connections.ts` shares route geometry between the editor and publication exports. Exported SVG/PNG/HTML/GIF use the chosen routing and basic block appearance. Programmable masks are represented by a static “JS module” label in publication exports; JSON retains the executable source. The publication GIF's existing global flow animation remains independent of editor animation settings.
