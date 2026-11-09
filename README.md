# milver

A React + TypeScript block-diagram editor built with React Flow and actual [shadcn/ui](https://ui.shadcn.com/) components. The canvas fills the browser; controls and independently collapsible panels float above it.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` creates `dist/`, `npm run preview` serves the production build, and `npm test` runs the model tests.

## Workspace

- The hamburger button opens/closes the floating block library. The top-right panel button opens/closes the inspector. Each panel also has its own close button.
- The canvas toolbar floats at the top center. Import, export, and JSON editor use icon buttons with accessible labels and tooltips.
- Drag a block from the library to place it. Clicking a library item adds a block near the viewport center.
- Drag blocks to move them. Select a block to reveal four corner resize handles. The inspector edits names, values, descriptions, dimensions, and ports.
- Inputs and outputs can sit on the left, right, top, or bottom. Multiple ports on a side are evenly spaced. Move a port and its connections follow it.
- Drag a filled output to a hollow input to connect them. Outputs can fan out; each input accepts one connection. Connections between different blocks can form feedback loops.
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

The first workspace uses a black-and-white Neutral palette. Open the palette icon to change Light/Dark mode, choose a preset, tune **OKLCH hue and chroma**, or change corner radius. Chroma 0 is monochrome. Theme settings are saved and included in diagram JSON. Blocks, ports, floating panels, dialogs, and controls share the same semantic CSS variables. Legacy per-block `data.color` remains in the JSON for compatibility; rendering uses the workspace theme.

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

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select / pan tool | V / H |
| Temporarily pan | Space + drag |
| Fit canvas | 1 |
| Search blocks | / |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z |
| Duplicate selection | Cmd/Ctrl+D |
| Delete selection | Delete / Backspace |
| Export JSON | Cmd/Ctrl+S |
| Leave parent canvas | Escape |

Shortcuts do not run while typing in fields or using a dialog, select, or slider.

## Attribution

React Flow is MIT licensed. The application hides its on-canvas badge using `proOptions.hideAttribution` and retains the copyright and permission notice in `THIRD_PARTY_NOTICES.txt` and the production asset `xyflow-LICENSE.txt`, linked from Help. The maintainers request supporting the project through React Flow Pro when removing the badge; see their [attribution guidance](https://reactflow.dev/remove-attribution).

The editor uses the official `@xyflow/react` package from [xyflow/xyflow](https://github.com/xyflow/xyflow). A reference checkout was fetched to `/tmp/reactflow-recipes-xyflow-reference` during initial development.

This is a diagram editor, not a numerical simulation engine. The block presets do not execute calculations or fabricate signal results.
