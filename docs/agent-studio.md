# Linforge — Design Document

> **Linforge** — An embeddable development workbench for LangGraph Agent applications.
> Incubated from the ContentRadar project, maintained by LianBuilds.
> Discussion started: 2026-02-23
> Interactive prototype: `./agent-studio-prototype.html` (Blueprint + Run/Debug dual modes)

## Product Positioning

**Linforge** is an embeddable development workbench for LangGraph Agent applications that unifies editing, running, debugging, and monitoring in one place.

How it differs from LangGraph Studio (official):

- Web-embeddable (not a desktop app) — integrates directly into your product UI
- In-browser Prompt editing with version management (not available in official Studio)
- Run agents and inspect results without leaving the Studio (edit prompt → run → review → iterate)
- **Visual graph orchestration**: wire nodes and configure on canvas — no code changes or restarts
- **Product-dev collaboration**: product managers sketch the graph, developers fill in implementations
- Production monitoring capabilities (beyond just dev-time debugging)

## Core Architecture: Hybrid Layered (Code + Visual)

Three layers, each with a clear responsibility:

```
Layer 1 (Code - developer):     Node impl + State schema + Route functions
Layer 2 (Visual - dev/product): Topology + Wiring + Prompt + Parameters (DB-backed)
Layer 3 (Toolkit - auto):       Compiler combines L1 + L2 into executable graph
```

Product and dev collaborate on the canvas to define graph topology (skeleton nodes), then dev writes code to bind implementations. Prompts, parameters, and runs are all managed visually in the Studio.

### Design Principles

- **Graph topology is designed on canvas** (DB-stored) — product and dev collaborate, sketch first, code later
- **Node implementations are code** (registry-based) — avoids the expressiveness limits of low-code
- **Conditional route functions are code-registered** (DB only stores keys) — avoids expression engine complexity
- **State schema is code-defined** — tied to business data structures, no need for visual definition
- **Compiler complexity stays bounded** — assembles `addNode`/`addEdge`/`addConditionalEdges` + optional StepRecording injection

### Why Not Pure Code-First

- Pure code graph orchestration in `graph.ts` lacks visibility — changing one edge means editing code + restarting
- Graph structure changes happen frequently during development (especially during Prompt iteration)
- Non-developers (product managers) cannot participate in graph structure discussions

### Why Not Pure Visual (Dify/Coze Approach)

- Node types also need visual definition, causing complexity to grow exponentially
- Complex logic (state reducers, channel mechanisms) is hard to express in form-based UIs
- Custom nodes require a plugin mechanism, which degrades the developer experience

### Landscape Comparison

| Tool             | Build approach                          | Orchestration | Execution              | Limitation                        |
| ---------------- | --------------------------------------- | ------------- | ---------------------- | --------------------------------- |
| Dify / Coze      | Pure visual drag-and-drop               | UI            | Runs from UI def       | Complex logic hard to express     |
| LangGraph Studio | Code-defined + visual viewer            | Code          | Code                   | Changing graph requires code edit |
| ComfyUI          | Visual editing for technical users      | UI            | JSON workflow          | Fixed node types                  |
| Rivet            | Visual edit → export JSON → code load   | UI            | JSON definition        | Smaller ecosystem                 |
| n8n / Prefect    | Visual DAG + code nodes                 | UI            | DB definition          | Not Agent-specific                |
| **Linforge**     | **Canvas design + code implementation** | **UI + Code** | **DB def + Code impl** | —                                 |

## Collaboration Workflow: Design First, Code Later

### Four-Phase Flow

```
Phase 1 - Design (product + dev, in Studio):
  Pick a template or start blank
  Drag skeleton nodes onto canvas, name them, write descriptions
  Wire edges (conditional edges marked as "pending")
  Result: graph topology in DB, no code behind it

Phase 2 - Implement (dev, in code):
  See skeleton nodes listed in Studio (gray/dashed = unbound)
  Write node functions with defineNode({ key: '...' })
  Studio auto-matches by key, nodes turn active (bound)
  Register route functions for conditional edges

Phase 3 - Configure (dev/product, in Studio):
  Write Prompts for LLM nodes
  Set parameters (temperature, limits, etc.)
  All in Studio UI, no code changes

Phase 4 - Run & Debug (in Studio):
  Trigger runs, inspect steps, iterate on Prompts
  Compare runs, tune parameters
  No restart needed
```

### Node States

| State                  | Meaning                                   | Canvas appearance    | Runnable |
| ---------------------- | ----------------------------------------- | -------------------- | -------- |
| **Skeleton** (unbound) | Metadata only, no code implementation     | Gray / dashed border | No       |
| **Bound**              | Metadata + code implementation registered | Normal display       | Yes      |

- The graph can only be compiled and run once all nodes are bound
- Attempting to run with skeleton nodes triggers a warning: "Unbound nodes: xxx, yyy"
- Conditional edges follow the same pattern: unbound route functions are marked as "pending"

### Graph Templates

Starting from a blank canvas is slow. Linforge provides built-in templates for common Agent patterns as starting points.

#### Built-in Templates

| Template          | Nodes                                                 | Use case                |
| ----------------- | ----------------------------------------------------- | ----------------------- |
| ReAct Agent       | planner → tools → processResults → checkLimits (loop) | Tool-calling Agent      |
| Pipeline          | step1 → step2 → step3 → save                          | Linear processing       |
| Map-Reduce        | split → parallel workers → merge → output             | Parallel processing     |
| Human-in-the-Loop | agent → review → (approve/reject) → ...               | Human approval required |

#### Template Data Format

Templates are pure topology descriptions (no positions). An automatic layout algorithm computes node positions:

```ts
interface GraphTemplate {
  id: string; // 'react-agent' | 'pipeline' | ...
  name: string; // Display name
  description: string; // One-line scenario description
  category?: string; // Category tag: 'agent' | 'pipeline' | 'pattern'
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

interface TemplateNode {
  key: string; // Skeleton node key
  label: string;
  description?: string;
  icon?: string; // Applied to GraphNodeDef.icon
  color?: string; // Applied to GraphNodeDef.color
}

interface TemplateEdge {
  source: string; // Node key
  target: string; // Node key
  routeMap?: Record<string, string>; // Conditional edge mapping
  label?: string;
}
```

#### Template Registration

Four built-in templates are hardcoded in the `core` package. Host projects register custom templates via `TemplateRegistry`:

```ts
import { TemplateRegistry, builtinTemplates } from 'linforge/core';

const templateRegistry = new TemplateRegistry();
templateRegistry.registerAll(builtinTemplates);

// Register host-specific templates
templateRegistry.register({
  id: 'content-pipeline',
  name: 'Content Analysis Pipeline',
  description: 'Fetch → Analyze → Generate topics',
  nodes: [...],
  edges: [...],
});

// Pass to mountRoutes
mountRoutes(app, { ..., templateRegistry });
```

#### Apply Strategy: Append-Merge (Not Replace)

Selecting a template calls `applyTemplate()`, which **appends** template content to the current canvas rather than replacing it. This supports composing multiple templates on a single graph:

- **Empty canvas**: fills directly
- **Existing content**: template nodes are placed in empty canvas area (auto-layout avoids existing nodes), user manually wires the two parts together
- **Key conflicts**: auto-suffixed (e.g., `planner` → `planner_2`), with a brief notification listing all renames
- **START/END handling**: when appending, template `__start__` / `__end__` edges are stripped — only intermediate nodes and their edges are kept

#### Template Selector UI

Template selection lives in the left panel's Blueprint Tab:

- **Persistent list**: compact card style showing template name, description, node/edge count
- **Empty canvas hint**: when the canvas has no nodes, a lightweight guide prompt appears above the template list
- **Status badges**: applied templates show a teal "Active" badge; unimplemented templates show a gray "Phase 2" badge

No full-screen onboarding page or modal dialogs.

## Package Structure (npm)

```
linforge/core     # Core logic: node registry, graph compiler, template registry,
                  # step recorder, run manager, prompt loader, store interfaces,
                  # type utilities (InferState, InferUpdate, defineNodeFor)
linforge/server   # Backend middleware: linforgeMiddleware (one-line setup) + mountRoutes (low-level)
linforge/react    # Frontend components: fine-grained components (GraphCanvas, TemplateList,
                  # NodePool, NodePropertyPanel, RunPanel, PromptEditor, StepDetailPanel,
                  # GraphStatusBar, LinforgeWorkbench, etc.)
linforge/testing  # In-memory Store implementations (dev / test)

# Adapter packages (separate npm packages in the same monorepo):
linforge-adapter-prisma  # Production-ready Prisma Store implementations
```

### Developer Code vs Toolkit Code

| Developer writes (project-specific)               | Linforge provides (generic)                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Node functions (`nodes/*.ts`)                     | Node Registry — register + discover + auto-match                                                       |
| State schema (Zod)                                | Graph Compiler — DB definition → LangGraph StateGraph                                                  |
| Conditional route functions                       | StepRecorder — auto-injection via compile options                                                      |
| Prompt seed data                                  | RunManager — trigger / cancel / abort                                                                  |
| **Store adapters** (implement toolkit interfaces) | PromptLoader — cache + fallback                                                                        |
| Custom templates (optional)                       | Template Registry — built-in + custom registration + append-merge                                      |
|                                                   | `mountRoutes(app)` — one-line API setup                                                                |
|                                                   | **Store interfaces** (GraphStore / StepPersister / PromptStore / RunStore)                             |
|                                                   | Fine-grained React components (GraphCanvas, TemplateList, NodePool, NodePropertyPanel, RunPanel, etc.) |
|                                                   | Built-in graph templates (ReAct, Pipeline, Map-Reduce, Human-in-the-Loop)                              |

### Node Registration Example

```ts
// nodes/planner.ts
import { defineNode } from 'linforge/core';

export default defineNode({
  key: 'planner', // Matches the skeleton node key on canvas
  // Conditional routes: key -> predicate, canvas conditional edges reference these keys
  routes: {
    has_tool_calls: (state) => state.messages.at(-1)?.tool_calls?.length > 0,
    text_response: (state) => !state.messages.at(-1)?.tool_calls?.length,
  },
  // Node execution function
  run: async (state) => {
    // ... business logic
  },
});
```

Note: `meta` fields (label, description, icon, hasPrompt) are **not** defined in code — they are set when creating the skeleton node on canvas and stored in DB. `defineNode()` is strictly for **code binding**.

### Graph Compiler Pseudocode

```ts
// linforge/core internals
function compileGraph(
  stateSchema: any,
  dbDefinition: GraphDefinition,
  registry: NodeRegistry,
) {
  // Validate: all nodes must be bound
  const unbound = dbDefinition.nodes.filter((n) => !registry.has(n.key));
  if (unbound.length > 0) {
    throw new Error(`Unbound nodes: ${unbound.map((n) => n.key).join(', ')}`);
  }

  const workflow = new StateGraph(stateSchema);

  for (const node of dbDefinition.nodes) {
    const impl = registry.get(node.key);
    workflow.addNode(node.key, impl.run);
  }

  // Group by source, compile conditional edges via routeMap
  const edgesBySource = groupBySource(dbDefinition.edges);
  for (const [source, edges] of edgesBySource) {
    const conditionalEdge = edges.find((e) => e.routeMap);
    if (conditionalEdge && conditionalEdge.routeMap) {
      const impl = registry.get(source);
      const routeMap = conditionalEdge.routeMap;
      const routeFn = (state) => {
        for (const key of Object.keys(routeMap)) {
          if (impl.routes[key]?.(state)) return key;
        }
        return Object.keys(routeMap)[0]; // fallback
      };
      workflow.addConditionalEdges(source, routeFn, routeMap);
    } else {
      for (const edge of edges) {
        workflow.addEdge(edge.source, edge.target);
      }
    }
  }

  return workflow.compile();
}
```

## UI: Unified Workbench (Monitor + Studio Merged)

### Layout

```
+--[Header]----------------------------------[StatusBar]--+
|  Agent Studio                    5/7 bound | Graph OK   |
+--[Left 280px]--+--[Canvas flex-1]--+--[Right 420px]-----+
| [Blueprint][Run]|                   |                    |
|-----------------|                   | NodePropertyPanel  |
| Templates       |  Blueprint/Replay |  - name, desc      |
|  ReAct [active] |                   |  - icon picker     |
|  Pipeline       |  Click node ->    |  - color picker    |
|  ...            |  right panel      |  - PromptEditor    |
|-----------------|                   |                    |
| Node Pool       |                   | -- or in Replay -- |
|  planner    [*] |                   |                    |
|  tools      [*] |                   | StepDetailPanel    |
|  analyzer   [*] |                   |  - output          |
+-----------------+-------------------+  - state snapshot  |
                                      +--------------------+
```

The left panel has two tabs (Blueprint / Run & Debug). The Blueprint tab shows template list and node pool; the Run & Debug tab shows RunPanel (instruction input + run history). The right panel displays either node property editing or step details depending on context. The top status bar shows binding progress and graph validation status. All three panels are collapsible — when all collapsed, the canvas fills the available space.

### Canvas Modes

`GraphCanvas` switches between two modes via the `mode` prop:

| Mode                    | Trigger                   | Behavior                                                                       |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| **Blueprint** (editing) | Default / no run selected | Drag nodes, wire edges, configure Prompts. Skeleton nodes shown as gray dashed |
| **Replay** (playback)   | A run is selected         | Nodes light up sequentially, click to view step output + state                 |

**Mode switching**: controlled by the host via `selectedRunId` — non-null → `mode='replay'`, null → `mode='blueprint'`. Clicking the same run card toggles selection. Switching to the Blueprint tab auto-exits replay (`selectRun(null)`); selecting a run auto-switches to the Run & Debug tab.

**Replay restrictions**: all editing operations are disabled (dragging, wiring, context menu, deletion, edge config popover). Template buttons and onboarding hints are hidden.

**Exiting replay**: a floating "Exit Replay" button (X icon) appears at the top-right of the canvas in Replay mode. Clicking it calls `selectRun(null)` to return to Blueprint mode. This button is rendered by the host (absolutely positioned over the canvas) so it remains accessible even when RunPanel is collapsed.

#### Node Replay States

`GraphCanvas` accepts `replaySteps: ReplayStep[]`, which are injected into node `data`.

```ts
interface ReplayStep {
  nodeKey: string;
  status: 'completed' | 'running' | 'failed';
  durationMs?: number;
  tokensUsed?: number;
}
```

| Status    | Border    | Background | Effect                              |
| --------- | --------- | ---------- | ----------------------------------- |
| idle      | `#e5e7eb` | `#fff`     | opacity 0.5                         |
| completed | `#10b981` | `#ecfdf5`  | green glow, bottom: duration+tokens |
| running   | `#3b82f6` | `#eff6ff`  | blue pulse animation (2s loop)      |
| failed    | `#ef4444` | `#fef2f2`  | red glow, bottom: duration+tokens   |

Terminal nodes (`__start__`/`__end__`) also support `replayStatus` but do not display bottom stats. `__start__` is auto-marked as completed when steps exist; `__end__` is marked completed when all steps are completed.

#### Edge Replay States

Edges along executed paths (both source and target have step records) use `animated: true`. Unexecuted edges use `opacity: 0.3`.

### Left Panel (Tabbed)

The left panel (280px) switches between two tabs. Linforge exports fine-grained sub-components (`TemplateList`, `NodePool`, `RunPanel`); the host is responsible for tab switching and layout assembly.

```
+---[Left Panel 280px]---+
| [Blueprint] [Run/Debug] |  <- Tab bar
|--------------------------|
| Blueprint Tab:           |
|   "Choose a template"   |  <- guide hint (empty canvas only)
|   [TemplateCard] active  |
|   [TemplateCard]         |
|   ---                    |
|   Node Pool              |
|   planner         [*]   |
|   tools           [*]   |
|   analyzer        [*]   |
|--------------------------|
| Run/Debug Tab:           |
|   [textarea 3 rows]     |
|   [teal gradient button] |
|   ---                    |
|   Run History            |
|   [RunCard] selected     |
|   [RunCard]              |
+---------------------------+
```

#### TemplateList Component

Replaces the deprecated `TemplateGallery`, simplified to a flat list:

- Compact cards: icon + name + description + node/edge count badges
- "Active" badge (teal): template currently applied to the canvas
- "Phase 2" badge (gray): unimplemented templates (controlled via `disabled` prop)
- Empty canvas hint: highlighted prompt at top when `isCanvasEmpty` is true
- Click triggers `onSelect(templateId)` callback
- Pure inline styles

#### NodePool Component

A persistent node pool in the left panel. Coexists with the context menu node pool (dual entry points):

- Each row: label + key (gray, truncated with `max-width: 45%`) + binding dot (green = bound, gray = skeleton/absent)
- Nodes already on canvas: semi-transparent (`opacity: 0.55`), clickable to view details (`onNodeClick` → opens right panel)
- Nodes not on canvas: normal style, click triggers `onAddNode(nodeKey, label)` (created at canvas center)
- Data source: `registryNodes` (shared with `GraphCanvas` context menu)
- Pure inline styles, no horizontal scroll (`text-overflow: ellipsis`)

#### RunPanel Component

Content for the Run & Debug tab. Provides run input and history list. Pure inline styles.

RunPanel manages state via the `useLinforgeRuns` hook. The host only passes `apiBase` + `slug`, and syncs `selectedRunId` and `replaySteps` to the canvas via `onRunSelect` / `onStepsChange` callbacks.

#### Panel Collapsing

The left panel can be collapsed entirely to maximize canvas space:

- Collapse state is managed by the host, which controls whether the left panel renders
- When collapsed, a floating button appears at the top-left of the canvas (sidebar icon). Clicking it expands the panel and restores the previously active tab
- Button style: white background, `border-radius: 10px`, 1px border, light shadow

**RunCard Three-Line Layout**:

- Line 1: instruction (truncated) + running pulse dot
- Line 2: status badge (running/completed/failed/cancelled) + relative time
- Line 3 (conditional): token pill + duration

**Polling Strategy**:

- List: 10s polling when a run is in `running` state
- Steps: 3s polling when the selected run is `running`
- AbortController for race condition prevention, auto-cleanup on unmount

### Core Workflow

```
1. Left panel Blueprint Tab: pick template or start blank
2. Add nodes from NodePool (left panel or right-click), name them, write descriptions
3. Wire edges on canvas (conditional edges marked as "pending")
4. Dev writes defineNode() to bind implementations, Studio auto-matches (NodePool dots turn green)
5. Click node -> right panel NodePropertyPanel: edit Prompt + temperature
6. Check top StatusBar: "7/7 bound, Graph OK" -> ready to run
7. Switch to Run/Debug Tab, enter instruction, click Run
8. Canvas auto-switches to Replay mode, executed nodes glow green, running nodes pulse blue
9. Click glowing node -> right panel shows StepDetailPanel (output + state)
10. Click same run card to deselect -> back to Blueprint mode
11. Edit Prompt, run again -> compare results
```

Steps 1-5 are done in the Blueprint tab (design + configure). Step 6 verifies readiness via the status bar. Steps 7-11 are done in the Run & Debug tab (run + debug iteration loop).

### NodePropertyPanel Component

Right panel (420px), displayed when any node is clicked. Linforge exports the full component; the host only passes props. Pure inline styles.

```
+--[NodePropertyPanel 420px]--+
| [icon] planner               |
| ReAct Planner                |
|------------------------------|
| Node Name    [input]         |
| Description  [textarea]      |
| Icon         [8-12 grid]     |
| Color        [7 circles]     |
|------------------------------|
| PROMPT (hasPrompt only)      |
| [version dropdown]           |
| [monospace textarea]         |
| Placeholders | Temperature   |
| [Save new version] [Activate]|
+------------------------------+
```

Clicking any node (not just `hasPrompt` nodes) opens this panel. Nodes with `hasPrompt` show the integrated PromptEditor at the bottom.

#### Property Editing

- **Name**: single-line input, debounced auto-save on change
- **Description**: multi-line textarea, debounced auto-save on change
- **Icon**: grid picker with 8–12 built-in icons (inline SVG, no dependency on host icon libraries), click to save. Extensible via `extraIcons` prop
- **Color**: 7 preset color circles (teal/blue/amber/purple/pink/green/gray), click to save
- No read/edit mode toggle — all fields are always editable

#### Built-in Icon Set

Linforge ships with icons covering common Agent scenarios (rendered as inline SVG):

| Icon      | Meaning           | Typical node type |
| --------- | ----------------- | ----------------- |
| edit      | Edit / Plan       | planner           |
| eye       | Observe / Analyze | analyzer          |
| zap       | Execute / Action  | tools             |
| lightbulb | Generate / Idea   | generator         |
| link      | Connect / Link    | connector         |
| smile     | Interact / Human  | human review      |
| square    | Generic / Block   | generic           |
| copy      | Save / Output     | save/output       |

#### Built-in Color Presets

| Color  | Hex       | Typical use     |
| ------ | --------- | --------------- |
| teal   | `#0d9488` | Default/primary |
| blue   | `#2563eb` | Tool/execution  |
| amber  | `#d97706` | Condition/check |
| purple | `#7c3aed` | Analysis/AI     |
| pink   | `#db2777` | Human/review    |
| green  | `#059669` | Save/complete   |
| gray   | `#6b7280` | Generic/utility |

#### Prompt Placeholder Documentation

`promptPlaceholders?: Record<string, string[]>` is an optional prop. Keys are node keys, values are placeholder name arrays. When provided, placeholders are rendered below the Prompt textarea as teal code badges (e.g., `{status}`, `{instruction}`), displayed alongside the Temperature input. When not provided, shows "None".

The host defines each node's placeholders (business-specific); Linforge only renders them.

#### Node Card Color Application

`LinforgeNode` reads `icon` and `color` fields and applies them to canvas node cards:

- **Icon**: rendered as inline SVG (14px) to the left of the title, using the node's color
- **Color**: left accent line, Handle dots, selected border, and outer glow all use the node's color (looked up from `BUILTIN_COLORS`, fallback `#0d9488`)

#### Persistence Mechanism

Property changes notify the host via `onNodeChange(nodeKey, changes)`. The `changes` type is `Partial<Pick<GraphNodeDef, 'label' | 'description' | 'icon' | 'color'>>`. The host updates the corresponding node in its local `graphDef` and triggers the existing `saveGraph(graphDef)` debounced full-graph PUT. No per-node API is introduced.

`saveGraph` supports optimistic updates: local `graphDef` state is updated immediately on invocation (canvas reflects changes instantly), with the PUT request sent after a 500ms debounce.

Prompt editing retains the existing manual save mechanism ("Save as new version" + "Activate this version" buttons).

#### Right Panel Context Switching

| Mode      | Node click target     | Panel content                                             |
| --------- | --------------------- | --------------------------------------------------------- |
| Blueprint | Any node              | NodePropertyPanel (with PromptEditor for hasPrompt nodes) |
| Replay    | Node with step record | StepDetailPanel (output + state snapshot)                 |
| —         | Canvas blank area     | Panel closes                                              |

### GraphStatusBar Component

Top status bar showing binding progress and graph validation status. Linforge exports the component; the host places it in the header area.

#### Display Content

- **Binding progress**: `X/Y nodes bound` (X = bound node count, Y = total non-start/end node count)
- **Validation badge**: `Graph Valid` (green) or `Graph Invalid` (red)

#### Validation Rules

A graph is considered "valid" when all of the following are met:

1. All non-start/end nodes are bound (no skeletons)
2. All conditional edge source nodes have registered routes (no pending conditional edges)

Connectivity checks are not performed (isolated nodes don't prevent compilation). This can be extended later.

#### Props

```ts
interface GraphStatusBarProps {
  skeletonKeys: string[];
  registryNodes: RegistryNode[];
  graphDef: GraphDefinition | null;
}
```

## Design Reference

> Linforge was incubated from the ContentRadar project. The following modules provided design insights.
> Linforge is implemented independently and does not reuse ContentRadar code.

| Reference module                                | Value                 | Linforge's independent implementation                                                         |
| ----------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| GraphPanel + AgentNode + SmartEdge              | Interaction patterns  | Independent implementation with skeleton node rendering + registry-driven matching            |
| StepRecorder (withStepRecording)                | Interface abstraction | `StepPersister` interface + Compiler auto-injection (`summarizeOutput` from `NodeDefinition`) |
| PromptEditor + version management               | Feature design        | `PromptStore` full interface + `PromptEditor` component + `useLinforgePrompt` hook            |
| Run management (trigger/cancel/history/polling) | Feature design        | `RunManager` + `RunStore` interface                                                           |
| Graph Compiler                                  | Core innovation       | DB graph definition + NodeRegistry → LangGraph compilation                                    |
| Node Registry                                   | Core innovation       | Register + auto-match + bound/skeleton state                                                  |
| Template Library                                | Complete              | `TemplateRegistry` + `applyTemplate()` + 4 built-in templates + `TemplateList` component      |

## Run Data Model and Store Interfaces

### RunRecord — Generic Run Model

Linforge defines a generic run concept at the execution layer. Business-specific context is passed via the `metadata` field.

```ts
interface RunRecord {
  id: string;
  graphSlug: string; // Which graph this run belongs to
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  input?: Record<string, unknown>; // Run input (generic JSON, host decides content)
  result?: Record<string, unknown>; // Run result (generic JSON)
  metadata?: Record<string, unknown>; // Business context (userId, tenantId, source, etc.)
  tokensUsed: number;
  startedAt: Date;
  finishedAt?: Date;
}
```

### Store Interfaces (Complete)

```ts
interface RunStore {
  createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(
    graphSlug: string,
    opts?: { limit?: number; offset?: number; metadata?: Record<string, unknown> },
  ): Promise<RunRecord[]>;
  updateRunStatus(
    runId: string,
    status: RunRecord['status'],
    data?: Record<string, unknown>,
  ): Promise<void>;
}

interface StepPersister {
  createStep(data: StepData): Promise<void>;
  getSteps(runId: string): Promise<StepData[]>;
}
```

### Server Routes

| Method | Path                                             | Description                 |
| ------ | ------------------------------------------------ | --------------------------- |
| GET    | `{prefix}/graphs`                                | List graphs (summary)       |
| GET    | `{prefix}/graph/:slug/runs`                      | Run history (paginated)     |
| GET    | `{prefix}/runs/:runId`                           | Run details                 |
| GET    | `{prefix}/runs/:runId/steps`                     | Step list                   |
| GET    | `{prefix}/prompts/:nodeId`                       | Prompt version list         |
| GET    | `{prefix}/prompts/:nodeId/active`                | Active Prompt version       |
| POST   | `{prefix}/prompts/:nodeId`                       | Create new Prompt version   |
| POST   | `{prefix}/prompts/:nodeId/versions/:id/activate` | Activate a specific version |

### Host Adapter Example (Prisma)

```
RunRecord.id            <-> AgentRun.id
RunRecord.graphSlug     <-> AgentRun.graphSlug (new field)
RunRecord.status        <-> AgentRun.status (enum mapping)
RunRecord.input         <-> { instruction: AgentRun.instruction }
RunRecord.result        <-> AgentRun.stateSnapshot
RunRecord.tokensUsed    <-> AgentRun.tokensUsed
RunRecord.startedAt     <-> AgentRun.startedAt
RunRecord.finishedAt    <-> AgentRun.finishedAt
                            AgentRun.userId — handled internally by adapter
                            AgentRun.costUsd — same
```

Adapter code lives in the host project (e.g., `src/linforge/`), not inside the Linforge package.

## Design Decisions

### 1. DB Ownership → Interface-Based

Linforge defines Store interfaces (`GraphStore`, `StepPersister`, `PromptStore`, `RunStore`). Host projects implement their own adapters (Prisma/Drizzle/Mongo/etc.). Linforge has zero DB dependencies — no schema files, no connection management.

### 2. Frontend Component Granularity → Fine-Grained First, Compose Later

Start with independent components: `<GraphCanvas />`, `<RunPanel />`, `<PromptEditor />`, `<NodePropertyPanel />`, etc. Later compose into `<LinforgeWorkbench />` for one-line integration.

### 3. State Snapshot Strategy → Summary by Default, Full in Debug Mode

Controlled via configuration (`{ debug: true }`). Default records only output summaries to limit storage; debug mode records full state snapshots.

### 4. Run Comparison → Result Diff + Node Output Diff First

Prioritize comparing final results and per-node output diffs between two runs. Full state diff as a future extension.

### 5. Node Pool UI → Enhanced Context Menu

Right-clicking the canvas opens a node selector listing registered nodes. No top toolbar button (adding nodes is a frequent operation, right-click feels more natural).

### 6. Skeleton Node Key Assignment → Manual Input (Custom Nodes)

Two creation paths:

- **Registered node**: click in context menu → created directly, key/label from registry, no dialog
- **Custom skeleton**: click "Custom Node" → dialog for manual key + label input (`CreateNodeDialog`)
- **Duplicate prevention**: nodes already on canvas are grayed out (duplicate keys would cause compile conflicts)

### 7. Graph Topology Source → Entirely from DB

Graph structure is created and edited on canvas, stored in DB (via `GraphStore` interface). No code-to-DB seed generation needed.

### 8. Blueprint ↔ Replay Switching → Driven by selectedRunId

No selected run → Blueprint. Selected run → Replay. Clicking the same run card toggles selection. No extra toggle button — mode follows data state naturally.

### 9. Run History Search → Client-Side Filtering

List is capped at `limit=50`, making client-side filtering sufficient. No `search` parameter on `RunStore.listRuns` — avoids requiring every adapter to implement search logic, and `RunRecord.input` is generic JSON with no guaranteed searchable fields. Hosts can extend with their own search routes if needed.

### 10. GraphNodeDef Extension Fields → metadata Passthrough

Host DBs may contain business-specific fields unknown to Linforge (e.g., `configSummary`, `handlerKey`, `config`). `GraphNodeDef` includes `metadata?: Record<string, unknown>` — Linforge doesn't interpret it but passes it through for storage. Adapters pack/unpack host-specific fields into/from `metadata`, keeping the generic type clean.

### 11. nodeType → Relaxed to string

`GraphNodeDef.nodeType` is `string` rather than a narrow union. Linforge only treats `'start'` / `'end'` specially (renders terminal nodes); all other values render as regular nodes. Hosts can pass arbitrary business types (e.g., `'llm'`, `'tool'`, `'condition'`). Linforge passes them through without interference.

Rationale: Linforge doesn't have type-driven special UI (unlike Dify/n8n where node type determines rendering). Node behavior is determined by `defineNode()` code, not by type. If type-driven rendering becomes needed, the type can be narrowed to a controlled enum later.

### 12. Conditional Edge Storage → routeMap Replaces conditionKey/conditionValue

`GraphEdgeDef.routeMap` (`Record<string, string>`, route key → target node key) is the canonical format. The earlier `conditionKey` + `conditionValue` approach (from ContentRadar's initial design) is deprecated. Adapters map `GraphEdgeDef.routeMap` directly to their DB schema.

### 13. PromptStore Design → Standalone Thin Adapter

`PromptStore` provides complete Prompt version management:

```ts
interface PromptStore {
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  listVersions(nodeId: string): Promise<PromptVersion[]>;
  createVersion(
    nodeId: string,
    data: CreatePromptVersionInput,
  ): Promise<PromptVersion>;
  activateVersion(nodeId: string, versionId: string): Promise<void>;
}
```

- `PromptVersion` extends `PromptTemplate` with `nodeId`, `version`, `isActive`, `createdAt`
- Each save creates a new immutable version (auto-incrementing version number); activation is mutually exclusive per nodeId
- Host implements a `PrismaPromptStore` adapter mapping to their `PromptTemplate` table
- `PromptStore` serves Linforge routes and components; the host's `promptLoader` (with caching) serves Agent execution — two independent entry points

### 14. Dual Run Paths → Converged (Phase 2.5)

After Phase 2.5 validation, the Linforge run entry point (`POST /api/linforge/graph/:slug/run` → `RunManager` → `GraphCompiler`) is the sole Agent execution path. The legacy entry point (`POST /api/agent/run` → `runner.ts` → hardcoded `graph.ts`) is deprecated. Read-only APIs (`GET /api/agent/runs`, etc.) are retained for legacy frontend pages and will be removed after frontend migration.

### 15. Left Panel Tab Ownership → Fine-Grained Sub-Components (Host Assembles)

Linforge exports `TemplateList`, `NodePool` sub-components. Tab switching logic is assembled by the host. Consistent with Decision #2 (fine-grained first). Hosts can freely customize tab styles and arrangement.

### 16. Template Display → Downgraded to Left Panel List

Removed the full-screen onboarding page (`TemplateGallery mode='page'`) and modal dialog (`mode='dialog'`). Unified into the left panel `TemplateList` component. Empty canvas shows a lightweight guide hint above the list. `TemplateGallery` is deprecated.

### 17. Node Pool Entry Points → Dual Entry Coexistence

Left panel `NodePool` component (persistent, view binding status) + context menu node list (position-aware quick add) coexist. Both share the `registryNodes` data source. Left panel click creates nodes at canvas center; context menu click creates at the right-click position.

### 18. Right Panel NodePropertyPanel → Full Component from Linforge

`NodePropertyPanel` bundles property editing (name/description/icon/color) + PromptEditor integration. The host only passes props. Panel structure is consistent across all hosts. Name/description/icon/color use debounced auto-save (via `onNodeChange` callback + existing `saveGraph` full-graph PUT). Prompt retains manual "Save as new version". Ships with 8 built-in icons + 7 color presets, no dependency on host icon libraries.

## Node Pool

The Node Pool is the frontend projection of the NodeRegistry, allowing canvas users to see code-registered nodes and quickly add them to the canvas.

### Entry Points (Dual Entry Coexistence)

**Entry 1: Left panel `NodePool` component** (persistent, view binding status + add/inspect)

- Registered node list: label + key (gray, truncated) + binding dot (green = bound, gray = skeleton/absent)
- Nodes on canvas: semi-transparent, clickable for details (`onNodeClick` → canvas node selection → right panel)
- Nodes not on canvas: click `onAddNode(nodeKey, label)` → created at canvas center

**Entry 2: Context menu `ContextMenu`** (position-aware quick add)

Enhanced context menu with two sections:

1. **Registered node list** — from `registryNodes` (`GET /registry/nodes`), each showing label + key
   - Nodes already on canvas: grayed out + click disabled (duplicate keys cause compile conflicts)
   - Nodes not on canvas: click creates directly, key/label from registry, position at right-click coordinates, no dialog
2. **"Custom Node" entry** — below a separator, opens the existing `CreateNodeDialog` (manual key + label input, creates a skeleton node)

### Data Flow

```
GET /registry/nodes
  -> useLinforgeGraph.registryNodes (already loaded)
  -> GraphCanvas passes to ContextMenu
  -> ContextMenu renders list, compares with existingKeys for disable state
  -> Click registered node -> onAddRegisteredNode(nodeKey, label, position)
  -> Click custom node    -> onAddNode() -> CreateNodeDialog (existing flow)
```

### Creation Behavior

| Scenario              | Key source | Label source | Dialog           | Result        |
| --------------------- | ---------- | ------------ | ---------------- | ------------- |
| Click registered node | registry   | registry     | None             | Bound node    |
| Click "Custom Node"   | Manual     | Manual       | CreateNodeDialog | Skeleton node |

## Conditional Edge Configuration

### Data Flow

The conditional edge `routeMap` (`Record<string, string>`, route key → target node key) flows through the entire data chain:

```
DB (GraphEdgeDef.routeMap)
  -> buildLayout() -> edge.data.routeMap (React Flow)
  -> toGraphDef()  -> GraphEdgeDef.routeMap (saved back to DB)
```

`buildLayout()` receives `routeKeysMap` (from the Registry API) to distinguish pending vs active conditional edge states.

### Visual Distinction

| Edge type             | Style                                          | Trigger condition                            |
| --------------------- | ---------------------------------------------- | -------------------------------------------- |
| Normal edge           | Solid, brand color `#2dd4bf`                   | No `routeMap`                                |
| Conditional (active)  | Dashed `strokeDasharray: 6 3`, amber `#f59e0b` | Has `routeMap` and source node has routes    |
| Conditional (pending) | Dashed `strokeDasharray: 6 3`, gray `#9ca3af`  | Has `routeMap` but source node has no routes |

### EdgeConfigPopover

Clicking an edge opens a configuration popover (pure inline styles):

- **Label input**: edit the edge's `label`
- **Conditional edge toggle**: enable/disable conditional edge
- **Route key mapping**: when toggled on, displays the source node's registered route keys with their current targets
- **Auto-fill**: when toggling OFF → ON, automatically maps each route key to the current `edge.target` as the default
