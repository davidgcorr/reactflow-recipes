# Flowbench — React Flow block editor recipe

A runnable React + TypeScript recipe using [`@xyflow/react`](https://github.com/xyflow/xyflow). The upstream repository was fetched for reference into `/tmp/reactflow-recipes-xyflow-reference`; this project consumes its published React package rather than embedding the monorepo.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the production app in `dist/`; `npm run preview` serves that build. `npm test` checks the diagram model and JSON validation.

## Use

- Drag a block from the library and drop it anywhere on the canvas. Clicking a library block also adds it.
- Drag blocks to move them. Select a block to reveal four corner resize handles.
- Use the Inspector to edit its label, displayed value, description, color, dimensions, and ports.
- Select an input/output row in the Inspector to edit its name and choose **left, right, top, or bottom**. Multiple ports on a side are evenly distributed. Connected arrows follow moved ports.
- Drag a filled output handle to a hollow input handle to connect blocks. Outputs support fan-out; inputs accept one connection. Self-connections and invalid directions are rejected. Feedback through different blocks is supported.
- Scroll/pinch to zoom; hold Space and drag, use middle/right drag, or choose the hand tool to pan. In select mode, drag the background to select several blocks. Shift-click also selects multiple blocks.
- Use the toolbar for undo/redo, snap to grid, zoom, and fit-to-view. The minimap also pans and zooms.
- Export JSON to download a diagram, import a file, or edit and apply JSON directly with **JSON editor**. Imports are validated before modifying the canvas. A successful import can be undone.
- Edits and viewport are automatically saved in browser local storage. Export a file for a portable copy.

Shortcuts: `V` select, `H` pan, `1` fit, `Delete`/`Backspace` delete, `⌘/Ctrl+Z` undo, `⌘/Ctrl+Shift+Z` redo, `⌘/Ctrl+D` duplicate, `⌘/Ctrl+S` export. Shortcuts do not run while editing text fields.

This is a **diagram editor**, not a numerical simulation engine. Constant, Gain, Sum, Integrator, Scope, and Custom are editable visual block presets; no simulation results are fabricated.

An importable example is included at [`examples/two-blocks.json`](examples/two-blocks.json).

## JSON ↔ UI

`src/model.ts` defines the complete versioned JSON contract, templates, serializer, and validator. `src/App.tsx` renders the custom block and editor. `src/styles.css` styles the workspace.

```json
{
  "version": 1,
  "name": "My system",
  "nodes": [
    {
      "id": "source",
      "type": "block",
      "position": { "x": 0, "y": 0 },
      "width": 164,
      "height": 116,
      "data": {
        "label": "Source",
        "kind": "constant",
        "description": "A fixed signal value",
        "color": "#7b69db",
        "value": "1",
        "ports": [
          { "id": "out", "name": "out", "type": "output", "side": "right" }
        ]
      }
    },
    {
      "id": "sink",
      "type": "block",
      "position": { "x": 300, "y": 0 },
      "width": 164,
      "height": 116,
      "data": {
        "label": "Destination",
        "kind": "custom",
        "description": "A custom block",
        "color": "#35977c",
        "value": "f(x)",
        "ports": [
          { "id": "in", "name": "in", "type": "input", "side": "left" }
        ]
      }
    }
  ],
  "edges": [
    { "id": "signal", "source": "source", "sourceHandle": "out", "target": "sink", "targetHandle": "in", "type": "smoothstep" }
  ],
  "viewport": { "x": 80, "y": 160, "zoom": 1 }
}
```

IDs must be unique. Ports need unique IDs within each block. Width must be at least 120, height at least 90; viewport zoom ranges from 0.15 to 2.5. Import limits are 2,000 blocks and 10,000 connections. Connections must reference existing output and input handles. Deleting a block or port removes its incident connections. Transient selection and measurements are excluded from JSON. Background grid, resize controls, and edge routing are editor conventions, rather than per-diagram data.

To add another preset, add an entry to `templates` in `src/model.ts`; the library and node creation use it automatically. `makeNode`, `serializeDiagram`, and `parseDiagram` can be reused independently by a parent application.
