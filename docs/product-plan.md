# Milver product and architecture plan

Status: shared-module foundation implemented. The broader milestones below remain the product roadmap.

Implemented: project-wide ESM imports and export discovery; configurable function, constructor, method, property, and constant blocks; shared JS computation blocks; runtime object references; nested interface execution; pure-value caching; trigger/step sequencing; async functions; bounded tensor/object previews; runtime errors/timings; live/pause/run/step/stop/reset; and JSON persistence. Existing DOM masks retain their interaction API.

Validation: unit/integration coverage includes identity, sequencing, JSON round trips, imported files, nested instances, repeated equal-payload events, and a trainable user-defined module. Chrome smoke checks cover the bundled matrix/code/instance example, nested stepping, and terminating an infinite-loop worker while the editor remains responsive.

Current boundary: a CPU/Wasm worker inside an opaque-origin sandbox. Secure-context GPU APIs, a package bundler supporting arbitrary module graphs, model checkpoints/binary project bundles, advanced profiling, and broader browser/security testing remain future work. Module code can make network requests. See README for the current execution contract and restrictions.

## Product direction

Milver is a browser-only visual execution framework for numerical experiments, interactive JavaScript module testing, and AI systems. Users compose behavior from blocks, nested inports/outports, and imported modules. A Karpathy-style model is an example a user should be able to build with the framework; implementing or shipping that model is not the product objective.

Milver supplies general block execution, module loading, state and object lifetimes, execution controls, inspection, and reproducibility. Numerical operations, gradients, optimizers, and model algorithms can be supplied by imported modules and user-created blocks. Preserve interactive sources, nested canvases, and parent inports/outports. Avoid making the graph engine depend on one model architecture, numerical library, or training framework.

## Confirmed choices

- Desktop Chrome/Edge first; browser-only computation, without a required computation backend.
- Both matrix/numerical experiments and JavaScript module testing are first-class workflows.
- Support both forward passes and training, delivered through successive working milestones.
- Live updates, with Pause, Run once, and Step controls.
- Project-wide modules exposing functions, classes, and primitive exports both as configurable visual blocks and to JavaScript code.
- Create-instance and method-call blocks share the same live class instance through object-reference ports.
- Users run their own code and chosen libraries. Shared and potentially unreviewed projects must be accounted for in the execution design.
- Validate extensibility with user-built computational graphs. A Karpathy-style model is an optional demanding acceptance example; no specific model implementation or training throughput is promised.
- Python remains editable stored source; Python execution is outside this release.

## Imported exports as building blocks

Confirmed user experience:

- **Functions:** callable from JS blocks and available as function-call blocks with configurable argument/result ports.
- **Classes:** an instance-creation block plus method-call/property-access blocks, with an explicit runtime object reference connecting them.
- **Primitive exports:** available as code imports and as value/constant blocks.
- **Modules:** project-wide named definitions, visible in the module library and optionally on the canvas as Import module blocks. Avoid duplicating the source in each consumer.

Inspecting exported names is feasible after module evaluation. Arbitrary JavaScript does not reliably expose parameter types, argument names, output structure, or side effects. Accept a lightweight module manifest or let users configure ports and mappings; do not promise automatic complete block generation for every JavaScript API. Reflect useful hints into the UI while preserving an explicit, editable contract.

Object-reference ports are runtime handles. They allow instances, tensors, and model objects to remain in the shared runtime and be used by different blocks without pretending they are serializable JSON. These handles expire when their runtime generation is reset.

## Shared module experience

A visible Import module block references an entry in the project's module library. It registers a unique alias such as `linalg` or `nn`. Import from local source or browser-compatible ES module URLs. Show exported names and runtime types after loading, plus loading errors and dependency/version information.

Project modules are accessible from root and nested canvases. Each JavaScript block records which aliases it uses. A dependency inspector or optional dependency overlay shows those relationships without requiring module connections to look like numeric signal wires.

Proposed computation API (not the current mask API):

```js
export function run({ inputs, modules }) {
  const { matmul, relu } = modules.linalg;
  return { result: relu(matmul(inputs.x, inputs.weights)) };
}
```

All compute blocks in a project use the same execution environment and module registry. A module is resolved to a stable identity and evaluated once per runtime generation. Functions, classes, and class instances remain usable inside that environment. Named modules avoid injecting all exports into the JavaScript global namespace.

Sharing definitions and sharing mutable state are distinct. Use explicit state/model objects for persistent weights, optimizer state, and deliberately shared instances. Local block state stays local unless deliberately shared. Changing a module starts a new runtime generation and invalidates dependent results; the first implementation should offer a clear restart rather than mixing old and new class instances.

Browser-compatible ESM is the initial package contract. Arbitrary Node.js/PyTorch packages do not automatically work. Module dependency resolution needs a dedicated loader; the current iframe import-map mechanism cannot simply be assumed to apply to workers. Pin remote dependency identities and support embedding source for reproducibility/offline projects.

## Architecture

1. **Project document:** versioned graph, nested interfaces, code/modules, parameters, dependency identities, asset references, display settings, and optional explicit checkpoints.
2. **Execution engine:** one shared computation environment per project, normally worker-based to keep computation off the editor thread. Compile nested canvases into an execution graph while keeping their authoring hierarchy.
3. **Value/object store:** tensors and model instances stay in the computation environment. Ports can refer to runtime values; the editor requests metadata, selected slices, and diagnostics. Do not clone full matrices through React state on every update.
4. **Editor and views:** React Flow, controls, plots, tensor tables/heatmaps, code editor, errors, timings, and dependency inspection. Custom DOM masks remain a separate rendering API and communicate with computation through data/events.
5. **Execution isolation:** shared project code must remain outside the editor's privileged context. A worker is an execution mechanism, not a sufficient sandbox for hostile code. Prototype an origin/sandbox boundary, network policy, imports, and GPU capability before committing to the final isolation design. Blocks sharing a runtime share its trust level; they are not isolated from one another.

Use typed arrays with shape and dtype metadata for numerical data. Keep opaque references for functions, tensors, and class instances inside the runtime. Define ownership, disposal, and mutation rules before parallelizing. Start with one worker; add worker pools only when profiling identifies useful parallel workloads. GPU support is selected and benchmarked by capability, with a small CPU reference implementation for correctness checks.

## Execution rules

- Distinguish value changes, trigger events, and state updates. A button click must remain an event even if its payload equals a previous payload.
- Pure blocks recompute only when their inputs/configuration change. Do not rerun numerical work for layout, title, hover, or inspector edits.
- State/model updates occur at explicit execution boundaries. Live mode must not accidentally apply another optimizer step because a view changed.
- Training uses a controlled loop; do not overlap optimizer iterations. Pause stops scheduling new work; Stop/Reset may recreate the runtime to terminate a stuck synchronous computation.
- Run once evaluates a graph tick. Step advances one explicit training/execution iteration; stepping individual nodes can be a later debugger feature.
- Version asynchronous results so stale work cannot overwrite a newer graph/configuration.
- Keep feedback explicit through state/delay blocks. The training loop must not depend on uncontrolled reactive cycles.
- Live parameter changes apply at safe iteration boundaries. Structural/code changes pause training and require an explicit restart policy.

## Persistence contract

The project document is the authoring source of truth. Undo/redo, save/load, and JSON import/export must preserve all editable definitions, mappings, nested interfaces, and settings.

Live functions, class instances, GPU buffers, and arbitrary closures are not serialized to JSON. Reconstruct them from saved modules and configuration. Training weights, optimizer state, RNG state, and progress are saved only through an explicit supported checkpoint format. Do not write large weights into diagram history every iteration.

Small projects retain a complete portable JSON representation. Larger datasets/checkpoints should use a portable project bundle containing the same JSON manifest plus binary assets. Decide this format before promising large-model single-file exports. Local asset storage should use IndexedDB or an equivalent browser store, rather than expanding the current localStorage document indefinitely.

## Milestones and acceptance criteria

### 1. Shared module and execution prototype

- One Import module entry supplies an exported function, a class, and a constant to two JS blocks, including one nested block.
- Demonstrate shared module identity and an intentionally shared class instance inside the runtime.
- Preserve source/configuration through JSON round trips and undo/redo.
- Keep the editor responsive during computation; demonstrate stopping a stuck runtime.
- Validate the proposed isolation boundary, local and remote imports, and worker/GPU capabilities on target browsers.
- Separate the compute `run` API from the existing DOM `mount` API; define how current diagrams migrate.

### 2. Numerical and module-testing workbench

- Matmul, addition/broadcasting, transpose, reshape, reductions, and activations through a numerical module.
- Tensor shape/dtype inspection, clear invalid-shape errors, and selected-slice/heatmap views.
- Interactive sliders/buttons/selectors, typed inports/outports, nested function blocks, deterministic seeds, execution controls, timings, and fixtures.
- Module tests have saved input fixtures and expected outputs/tolerances.
- Benchmark memory use, execution latency, and editor responsiveness on named hardware and browser versions.

### 3. Stateful and iterative computation

- Generic instance-creation, method invocation, state, event, and loop/iteration capabilities, with clear sequencing of mutations.
- Support asynchronous module functions and expose errors, cancellation, and runtime lifetimes.
- Demonstrate that users can assemble a trainable small model using imported numerical/autodiff modules and ordinary framework blocks.
- Verify deterministic state updates, pause/resume, no overlapping iterations, memory disposal, and supported state/checkpoint adapters.
- Keep numerical/autodiff libraries behind ordinary module contracts or adapters. The framework should not require a particular engine.

### 4. Extensibility and scale validation

- Verify user-built module test benches, matrix pipelines, and nested numerical systems without changes to the framework engine.
- Optionally use a user-built Karpathy-style transformer to stress shared modules, object references, large tensors, iteration, and inspection.
- Record graph size, tensor sizes, iteration rate, peak memory, and UI responsiveness on named hardware. Increase workloads from measured baselines.
- Demonstrate that a project can swap numerical libraries or model implementations while preserving its outer inports/outports and interactive controls.
- Expand acceleration, persistence, or debugger capabilities only in response to measured gaps in these general workflows.

## Test strategy

- Versioned schema validation, migrations, JSON ↔ model ↔ UI round trips, and nested canvas preservation.
- Shared module identity, dependency invalidation, alias collisions, loading errors, and restart behavior.
- Typed tensor transport, object-handle lifetimes, disposal, async cancellation, and stale-result rejection.
- Operator correctness, shape/dtype errors, gradients, seeded model fixtures, and checkpoint restoration.
- Scheduler tests for event delivery, dirty propagation, pause/step/run, safe state updates, and nested inports/outports.
- Browser interaction tests for selection/dragging, sources, imports, code application, views, and export/reload.
- Measured performance and memory regression checks, including UI responsiveness during training.

## Decisions to settle next

1. Decide whether offline, self-contained imports/checkpoints are mandatory for the first release or a subsequent milestone.
2. Validate the isolation and network policy for unreviewed projects through the initial technical prototype.
3. Define the module manifest and port configuration experience for callable functions, constructors, methods, and constants.
4. Define ordering when multiple method-call blocks mutate the same instance, plus disposal and reset behavior.
5. Start performance measurements on the available MacBook Pro (Apple M5 Max, 48 GB), then add a more modest reference machine before generalizing performance claims.

## Browser constraints and references

- JavaScript modules are cached within an execution environment: [MDN import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).
- Functions cannot be structured-cloned; ordinary class prototype behavior is not preserved across message cloning: [MDN structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
- Workers run computation away from the editor thread and can be terminated: [MDN workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
- SharedArrayBuffer requires a secure, cross-origin-isolated context; it is an optional optimization, not a baseline requirement: [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer).
- nanoGPT is a PyTorch project with configurations ranging from small character models to much larger training runs: [nanoGPT](https://github.com/karpathy/nanoGPT), [character model configuration](https://github.com/karpathy/nanoGPT/blob/master/config/train_shakespeare_char.py).
