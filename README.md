# Linforge

[简体中文](./README.zh-CN.md)

Embeddable workbench for [LangGraph](https://langchain-ai.github.io/langgraphjs/) Agent apps — edit, run, debug, and monitor in one place.

> Built by [LianBuilds](https://github.com/LianBuilds)

## Features

- **Visual graph editor** — drag-and-drop nodes, smart edge routing, blueprint and replay modes
- **Prompt versioning** — edit, save, and activate prompt templates per node with full version history
- **Run & replay** — trigger agent runs, view step-by-step execution timeline with state diffs
- **Template system** — 4 built-in graph templates (ReAct, Pipeline, Map-Reduce, Human-in-the-Loop)
- **Store interface** — pluggable persistence via `GraphStore`, `RunStore`, `StepPersister`, `PromptStore`
- **One-line integration** — `<LinforgeWorkbench>` component embeds the full workbench in any React app
- **Multi-Agent mode** — bind distinct `stateSchema` and `nodes` per Agent via `agents` config; code-first GraphStore auto-sync
- **Run metadata** — pass business context (userId, tenantId, source) through run lifecycle and filter by metadata
- **Koa server routes** — `linforgeMiddleware()` for one-line setup, or `mountRoutes()` for full control — 16 REST endpoints

## Quick Start

### 1. Install

```bash
npm install linforge
# peer dependencies
npm install react react-dom @xyflow/react koa @koa/router
```

### 2. Server

```ts
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNodeFor } from 'linforge/core';
import { linforgeMiddleware } from 'linforge/server';

// Define state
const MyState = new StateSchema({
  messages: z.array(z.string()).default([]),
  result: z.string().default(''),
});

// Define nodes (with automatic state type inference)
const defineMyNode = defineNodeFor(MyState);

const greeter = defineMyNode({
  key: 'greeter',
  label: 'Greeter',
  run: async (state) => ({
    messages: [...state.messages, 'Hello!'],
    result: 'Greeting complete.',
  }),
});

// Start server — linforgeMiddleware handles everything
const app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [greeter],
}));
app.listen(3001);
```

> Need full control? Use `mountRoutes()` directly — see [examples/full-stack/](examples/full-stack/) for the manual assembly approach.

#### Multi-Agent mode

When you have multiple Agents with different state schemas or node implementations, use the `agents` config:

```ts
app.use(linforgeMiddleware({
  agents: [
    { slug: 'qa-bot', name: 'QA Bot', stateSchema: QAState, nodes: [retriever, answerer] },
    { slug: 'coder', name: 'Coder', stateSchema: CoderState, nodes: [planner, coder] },
  ],
  sharedNodes: [logger],  // available to all agents
}));
```

Each agent gets its own `NodeRegistry`, `GraphCompiler`, and `stateSchema`. The middleware automatically creates empty graph definitions in `GraphStore` for each agent on first request.

### 3. Frontend

```tsx
import { LinforgeWorkbench } from 'linforge/react';
import '@xyflow/react/dist/style.css';

function App() {
  return (
    <LinforgeWorkbench apiBase="http://localhost:3001" basePath="/linforge" />
  );
}
```

## Subpath Imports

| Import path        | Description                                 |
| ------------------ | ------------------------------------------- |
| `linforge`         | Re-exports all submodules                   |
| `linforge/core`    | Node definition, registry, compiler, runner |
| `linforge/server`  | Koa route mounting                          |
| `linforge/react`   | React components and hooks                  |
| `linforge/testing` | In-memory store adapters for testing        |

## Peer Dependencies

| Package         | Version                | Required for      |
| --------------- | ---------------------- | ----------------- |
| `react`         | `^18.0.0 \|\| ^19.0.0` | `linforge/react`  |
| `react-dom`     | `^18.0.0 \|\| ^19.0.0` | `linforge/react`  |
| `@xyflow/react` | `^12.0.0`              | `linforge/react`  |
| `koa`           | `^3.0.0`               | `linforge/server` |
| `@koa/router`   | `^15.0.0`              | `linforge/server` |

All peer dependencies are optional — install only what you need.

> **Note:** When using `linforge/react`, you must import the React Flow stylesheet:
>
> ```ts
> import '@xyflow/react/dist/style.css';
> ```

## API Overview

### Core

| Export                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `defineNode(options)`  | Create a typed node definition                    |
| `defineNodeFor(schema)` | Create a typed `defineNode` bound to a StateSchema (auto-infers state types) |
| `InferState<T>`        | Utility type: extract full state type from a StateSchema |
| `InferUpdate<T>`       | Utility type: extract partial update type from a StateSchema |
| `NodeRegistry`         | Register/discover nodes                           |
| `GraphCompiler`        | Compile graph definitions to LangGraph StateGraph |
| `RunManager`           | Execute graphs with abort, steps, and callbacks   |
| `createPromptLoader()` | Store-backed prompt loading with cache and Mustache rendering |
| `renderPrompt()`       | Pure Mustache template rendering (no HTML escaping) |
| `TemplateRegistry`     | Register and list graph templates                 |
| `applyTemplate()`      | Instantiate a template into a graph definition    |
| `withStepRecording()`  | Wrap node functions for automatic step recording  |

### Server

| Export                      | Description                          |
| --------------------------- | ------------------------------------ |
| `linforgeMiddleware(opts)`  | One-line Koa middleware — auto-creates Registry, Compiler, RunManager, Stores (recommended) |
| `mountRoutes(router, opts)` | Mount 16 REST routes on a Koa router (low-level API) |
| `AgentConfig`               | Type: per-agent configuration (slug, name, stateSchema, nodes) |
| `AgentContext`              | Type: runtime context resolved per slug (registry, compiler, stateSchema, buildInput) |

### React

| Export                | Description                                       |
| --------------------- | ------------------------------------------------- |
| `<LinforgeWorkbench>` | All-in-one workbench (graph list + canvas + runs) |
| `<GraphCanvas>`       | Graph editor with blueprint and replay modes      |
| `<RunPanel>`          | Run trigger, history, and step timeline           |
| `<PromptEditor>`      | Prompt template editing with versioning           |
| `<NodePropertyPanel>` | Inline node property editing                      |
| `<StepDetailPanel>`   | Step execution detail with state diff             |
| `useLinforgeGraph()`  | Hook for graph data fetching and mutation         |
| `useLinforgeRuns()`   | Hook for run management and step polling          |
| `useLinforgePrompt()` | Hook for prompt version CRUD                      |

### Testing

| Export                | Description              |
| --------------------- | ------------------------ |
| `MemoryGraphStore`    | In-memory graph store    |
| `MemoryRunStore`      | In-memory run store      |
| `MemoryStepPersister` | In-memory step persister |
| `MemoryPromptStore`   | In-memory prompt store   |

## Production Persistence

For production use, swap the in-memory stores with the Prisma adapter:

```bash
npm install linforge-adapter-prisma @prisma/client
```

```ts
import { createPrismaStores } from 'linforge-adapter-prisma';
import { PrismaClient } from '@prisma/client';

const stores = createPrismaStores(new PrismaClient());
```

See [`linforge-adapter-prisma`](./packages/adapter-prisma/) for setup details.

## License

[MIT](./LICENSE)
