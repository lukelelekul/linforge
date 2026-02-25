# Architecture Reference

> Module structure, file responsibilities, interface definitions, and API surface.
> For product vision and design rationale, see [agent-studio.md](./agent-studio.md).
> 中文版：[architecture.zh-CN.md](./architecture.zh-CN.md)

## Overview

Linforge is an embeddable development workbench for LangGraph Agent applications.
The core idea: **design topology on canvas, implement logic in code** — the compiler assembles both into an executable graph.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (ES2023, strict mode) |
| Build | tsup — dual ESM + CJS output |
| Test | vitest |
| Runtime deps | `@langchain/core`, `@langchain/langgraph`, `zod` |
| Optional peers | Koa (server), React + `@xyflow/react` (UI) |

## Package Exports

```
linforge          Root entry — re-exports all submodules
linforge/core     Core logic: defineNode, Registry, Compiler, RunManager, types
linforge/server   Koa HTTP router (mountRoutes)
linforge/react    React hooks and UI components
linforge/testing  In-memory Store implementations (dev / test)
```

## Directory Layout

```
src/
├── index.ts                      Package entry, re-exports submodules
├── core/
│   ├── types.ts                  All core types and interface definitions
│   ├── defineNode.ts             defineNode() factory
│   ├── NodeRegistry.ts           Node registry (key → NodeDefinition)
│   ├── GraphCompiler.ts          Graph compiler (GraphDef + Registry → Runnable)
│   ├── RunManager.ts             Run lifecycle (start / timeout / cancel)
│   ├── StepRecorder.ts           Automatic step recording wrapper
│   ├── PromptLoader.ts           Prompt loader with in-memory cache
│   ├── TemplateRegistry.ts       Graph template registry
│   ├── applyTemplate.ts          Merge a template into an existing graph
│   ├── builtinTemplates.ts       Built-in templates (ReAct, Pipeline, MapReduce, HITL)
│   ├── stateSanitizer.ts         State sanitization utilities
│   └── index.ts                  Core module exports
├── server/
│   ├── router.ts                 mountRoutes() — 16 REST endpoints
│   └── index.ts                  Server module exports
├── react/
│   ├── useLinforgeGraph.ts       Graph editing hook
│   ├── useLinforgeGraphList.ts   Graph list CRUD hook
│   ├── useLinforgeRuns.ts        Run management hook
│   ├── useLinforgePrompt.ts      Prompt version management hook
│   ├── useInternalRouter.ts      Internal routing hook
│   ├── graphLayout.ts            Auto-layout algorithm
│   ├── stateDiff.ts              State diff utility
│   ├── formatUtils.ts            Formatting helpers
│   ├── icons.ts                  Icon registry
│   └── index.ts                  React module exports
├── testing/
│   ├── MemoryGraphStore.ts       In-memory GraphStore
│   ├── MemoryRunStore.ts         In-memory RunStore
│   ├── MemoryStepPersister.ts    In-memory StepPersister
│   ├── MemoryPromptStore.ts      In-memory PromptStore
│   └── index.ts                  Testing module exports
├── __tests__/                    Test files
examples/
├── server.ts                     Full backend example
```

## Three-Layer Architecture

```
Layer 1 (Code):    Node implementations + StateSchema + Route predicates    [developer]
Layer 2 (Visual):  Topology + Wiring + Prompts + Parameters                [canvas / DB]
Layer 3 (Auto):    GraphCompiler merges L1 + L2 into a LangGraph Runnable  [linforge]
```

Developers write node logic in code; product managers design graph topology on canvas. The compiler bridges the two layers at runtime.

## Store Interfaces (DAO Layer)

Four database-agnostic interfaces defined in `src/core/types.ts`. Linforge ships in-memory implementations for development; production adapters are provided by the host application or separate adapter packages.

### GraphStore

Persists graph definitions (topology, nodes, edges, visual layout).

```typescript
interface GraphStore {
  getGraph(slug: string): Promise<GraphDefinition | null>;
  saveGraph(graph: GraphDefinition): Promise<void>;
  listGraphs(): Promise<GraphDefinition[]>;
}
```

### RunStore

Manages run records across their lifecycle.

```typescript
interface RunStore {
  createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(graphSlug: string, opts?: { limit?: number; offset?: number }): Promise<RunRecord[]>;
  updateRunStatus(runId: string, status: RunRecord['status'], data?: Record<string, unknown>): Promise<void>;
}
```

### StepPersister

Records individual node execution steps within a run.

```typescript
interface StepPersister {
  createStep(data: StepData): Promise<void>;
  getSteps(runId: string): Promise<StepData[]>;
}
```

### PromptStore

Version-controlled prompt management per node.

```typescript
interface PromptStore {
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  listVersions(nodeId: string): Promise<PromptVersion[]>;
  createVersion(nodeId: string, data: CreatePromptVersionInput): Promise<PromptVersion>;
  activateVersion(nodeId: string, versionId: string): Promise<void>;
}
```

## Data Entities

### GraphDefinition

```typescript
{ id, slug, name, icon?, nodes: GraphNodeDef[], edges: GraphEdgeDef[] }
```

### RunRecord

```typescript
{ id, graphSlug, status, input?, result?, tokensUsed, startedAt, finishedAt? }
```

### StepData

```typescript
{ agentRunId, nodeId, stepNumber, input, output, durationMs, tokensUsed, toolName?, stateBefore?, stateAfter? }
```

### PromptVersion

```typescript
{ id, template, temperature, nodeId, version, isActive, createdAt }
```

## REST API (mountRoutes)

`mountRoutes(app, options)` registers the following endpoints on a Koa application. Default prefix: `/linforge`.

| Method | Path | Description | Required Store |
|--------|------|-------------|---------------|
| GET | /graphs | List graphs (compact) | GraphStore |
| POST | /graphs | Create a new graph | GraphStore |
| PATCH | /graphs/:slug | Update graph metadata | GraphStore |
| GET | /registry/nodes | List registered nodes | NodeRegistry |
| GET | /graph/:slug | Get graph definition | GraphStore |
| PUT | /graph/:slug | Save graph definition | GraphStore |
| POST | /graph/:slug/run | Trigger a run | RunStore, RunManager |
| GET | /graph/:slug/runs | List run history (paginated) | RunStore |
| GET | /runs/:runId | Get run details | RunStore |
| GET | /runs/:runId/steps | List steps for a run | StepPersister |
| GET | /prompts/:nodeId | List prompt versions | PromptStore |
| GET | /prompts/:nodeId/active | Get active prompt version | PromptStore |
| POST | /prompts/:nodeId | Create a new prompt version | PromptStore |
| POST | /prompts/:nodeId/versions/:id/activate | Activate a prompt version | PromptStore |
| GET | /templates | List available templates | TemplateRegistry |
| POST | /graph/:slug/apply-template | Apply a template to a graph | GraphStore, TemplateRegistry |

Optional stores (`runStore`, `stepPersister`, `promptStore`) return `501 Not Implemented` when not provided.

## Development

```bash
pnpm run build        # Build with tsup
pnpm run typecheck    # Type-check with tsc --noEmit
pnpm run test         # Run tests with vitest
pnpm run test:watch   # Watch mode
```
