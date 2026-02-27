# Changelog

## 0.3.0 (2026-02-27)

### Server (`linforge/server`)

- **Multi-Agent mode** — `linforgeMiddleware({ agents: [...] })` allows each Agent to have its own `stateSchema`, `nodes`, and `buildInput`. Agents are identified by slug and routed independently.
- **`AgentConfig` / `AgentContext`** — new exported types for per-agent configuration and runtime context
- **`sharedNodes`** — register common node implementations across all agents
- **Code-first GraphStore sync** — when using `agents` mode, the middleware automatically creates empty graph definitions in `GraphStore` on first request (lazy sync); existing graphs are preserved
- **`GET /graphs` returns `codeFirst` flag** — frontend can detect whether graphs are code-managed
- **`POST /graphs` returns 403 in code-first mode** — graph creation is controlled by code, not the UI

### Core (`linforge/core`)

- **Fix: `defineNode()` now passes `label` field** — previously `label` was accepted in options but not included in the returned `NodeDefinition`

### React (`linforge/react`)

- **`useLinforgeGraphList` returns `codeFirst`** — read from `GET /graphs` response
- **`GraphListView` hides "Create Agent" button** in code-first mode

### Backward Compatibility

- Single-agent `{ stateSchema, nodes }` configuration continues to work unchanged — internally normalized to `agents: [{ slug: '*', ... }]`
- `createLinforgeRouter()` still accepts legacy `registry` / `compiler` / `stateSchema` fields

## 0.1.0 (2026-02-24)

Initial release.

### Core (`linforge/core`)

- `defineNode()` — declarative node definition with typed input/output
- `NodeRegistry` — register and discover nodes at runtime
- `GraphCompiler` — compile graph definitions into executable LangGraph StateGraph
- `RunManager` — invoke compiled graphs with AbortController, step recording, and callbacks
- `StepRecorder` — `withStepRecording()` wrapper for automatic per-node step persistence
- `PromptLoader` — `createPromptLoader()` with store-backed caching and fallback
- `TemplateRegistry` — register and apply graph templates
- `applyTemplate()` — instantiate a template into a full graph definition
- 4 built-in templates: ReAct Agent, Pipeline, Map-Reduce, Human-in-the-Loop
- `sanitizeState()` / `computeStateDiff()` — state snapshot utilities

### Server (`linforge/server`)

- `mountRoutes(router, options)` — mount 15 Koa REST routes:
  - Graph CRUD (`/graphs`, `/graphs/:slug`)
  - Node management (`/graphs/:slug/nodes`, `/graphs/:slug/nodes/:nodeKey`)
  - Edge management (`/graphs/:slug/edges`)
  - Run lifecycle (`/graphs/:slug/run`, `/runs/:runId`, `/runs/:runId/steps`)
  - Prompt versioning (`/prompts/:nodeId`, `/prompts/:nodeId/active`, `/prompts/:nodeId/versions/:id/activate`)
  - Template listing (`/templates`)

### React (`linforge/react`)

- `<LinforgeWorkbench>` — all-in-one embeddable component (graph list + canvas + run panel)
- `<GraphCanvas>` — React Flow-based graph editor with blueprint and replay modes
- `<RunPanel>` — run trigger + history list + step timeline
- `<PromptEditor>` — prompt template editing with version management
- `<NodePropertyPanel>` — inline node property editing (label, icon, color, description)
- `<SkeletonNodePanel>` — guided binding flow for skeleton nodes
- `<StepDetailPanel>` — step execution detail with state diff viewer
- `<TemplateList>` / `<TemplateGallery>` — template browsing and application
- `<NodePool>` — registered node discovery via context menu
- 5 hooks: `useLinforgeGraph`, `useLinforgeRuns`, `useLinforgePrompt`, `useLinforgeGraphList`, `useInternalRouter`

### Testing (`linforge/testing`)

- `MemoryGraphStore` — in-memory graph store
- `MemoryRunStore` — in-memory run store
- `MemoryStepPersister` — in-memory step persister
- `MemoryPromptStore` — in-memory prompt store
