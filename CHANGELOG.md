# Changelog

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
