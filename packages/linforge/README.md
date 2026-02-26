# Linforge

Embeddable workbench for [LangGraph](https://github.com/langchain-ai/langgraphjs) Agent applications — design topology on canvas, implement logic in code, compile into executable graphs.

## Why Linforge

| LangGraph Studio (official) | Linforge |
|------------------------------|----------|
| Desktop app | Web-embeddable — integrates into your product UI |
| Code-only graph definition | Visual canvas + code hybrid |
| Dev-only tool | Product managers sketch graphs, developers implement nodes |
| Dev-time debugging | Built-in run history, step replay, and prompt versioning |

## Install

```bash
npm install linforge
# or
pnpm add linforge
```

**Peer dependencies** (install only what you need):

```bash
# Server
pnpm add koa @koa/router

# UI
pnpm add react react-dom @xyflow/react
```

## Quick Start

A minimal server in ~30 lines:

```typescript
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNodeFor } from 'linforge/core';
import { linforgeMiddleware } from 'linforge/server';

// 1. Define state
const MyState = new StateSchema({
  messages: z.array(z.string()).default([]),
  result: z.string().default(''),
});

// 2. Define nodes — state type is inferred automatically
const defineMyNode = defineNodeFor(MyState);

const greeter = defineMyNode({
  key: 'greeter',
  label: 'Greeter',
  run: async (state) => ({
    messages: [...state.messages, '[greeter] Hello!'],
    result: 'Greeting complete.',
  }),
});

// 3. Start server
const app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [greeter],
}));

app.listen(3001);
```

This gives you a full REST API at `http://localhost:3001/linforge` — graph CRUD, run execution, step recording, and prompt management.

## Package Exports

```
linforge          Re-exports all submodules
linforge/core     defineNode, Registry, Compiler, RunManager, Store interfaces
linforge/server   Koa HTTP API (linforgeMiddleware + mountRoutes)
linforge/react    React hooks for graph editing, runs, and prompts
linforge/testing  In-memory Store implementations (dev/test)
```

## Core Concepts

### Three-Layer Architecture

```
Code Layer:    Node implementations + StateSchema + Route predicates    [developer]
Visual Layer:  Topology + Wiring + Prompts + Parameters                [canvas / DB]
Auto Layer:    Compiler merges both into a LangGraph Runnable           [linforge]
```

### defineNode

Create node implementations with `defineNode()` or the type-safe `defineNodeFor()`:

```typescript
import { defineNodeFor } from 'linforge/core';

const defineMyNode = defineNodeFor(MyState);

const planner = defineMyNode({
  key: 'planner',
  run: async (state) => ({
    plan: 'Step 1: fetch. Step 2: analyze.',
  }),
  // Optional: conditional routing
  routes: {
    has_plan: (state) => !!state.plan,
  },
});
```

### Store Interfaces

Four database-agnostic interfaces — implement them to plug in any database:

| Interface | Purpose |
|-----------|---------|
| `GraphStore` | Graph definition CRUD |
| `RunStore` | Run record lifecycle |
| `StepPersister` | Step data write/query |
| `PromptStore` | Prompt version management |

Linforge ships in-memory implementations (`linforge/testing`) for development. For production, use an adapter package (e.g., `linforge-adapter-prisma`) or implement the interfaces yourself.

## Server API

### linforgeMiddleware (recommended)

One-line setup that auto-creates all internal components:

```typescript
app.use(linforgeMiddleware({
  stateSchema: MyState,     // required — LangGraph StateSchema
  nodes: [planner, tools],  // required — node definitions
  prefix: '/linforge',      // default: "/linforge"
  stores: {                 // optional — custom Store implementations
    graphStore,
    runStore,
    stepPersister,
    promptStore,
  },
}));
```

### mountRoutes (low-level)

For full control over component creation. See [examples/full-stack/](https://github.com/lukelelekul/linforge/tree/master/examples/full-stack) for a complete example.

### REST Endpoints

All endpoints are prefixed with `/linforge` by default.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/graphs` | List graphs |
| POST | `/graphs` | Create graph |
| PATCH | `/graphs/:slug` | Update graph metadata |
| GET | `/graph/:slug` | Get graph definition |
| PUT | `/graph/:slug` | Save graph definition |
| POST | `/graph/:slug/run` | Trigger a run |
| GET | `/graph/:slug/runs` | List run history |
| GET | `/runs/:runId` | Get run details |
| GET | `/runs/:runId/steps` | List steps for a run |
| GET | `/registry/nodes` | List registered nodes |
| GET | `/prompts/:nodeId` | List prompt versions |
| GET | `/prompts/:nodeId/active` | Get active prompt |
| POST | `/prompts/:nodeId` | Create prompt version |
| POST | `/prompts/:nodeId/versions/:id/activate` | Activate prompt version |
| GET | `/templates` | List available templates |
| POST | `/graph/:slug/apply-template` | Apply template to graph |

Optional stores (`runStore`, `stepPersister`, `promptStore`) return **501** when not provided.

## React Hooks

```typescript
import {
  useLinforgeGraph,
  useLinforgeGraphList,
  useLinforgeRuns,
  useLinforgePrompt,
} from 'linforge/react';
```

| Hook | Purpose |
|------|---------|
| `useLinforgeGraph` | Graph editing (nodes, edges, save) |
| `useLinforgeGraphList` | Graph list CRUD |
| `useLinforgeRuns` | Run management (trigger, list, detail) |
| `useLinforgePrompt` | Prompt version management |

## Custom Store Adapter

Implement the four interfaces to connect any database:

```typescript
import type { GraphStore, RunStore, StepPersister, PromptStore } from 'linforge/core';

class MyGraphStore implements GraphStore {
  async getGraph(slug: string) { /* ... */ }
  async saveGraph(graph) { /* ... */ }
  async listGraphs() { /* ... */ }
}

// Pass to middleware
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [planner],
  stores: { graphStore: new MyGraphStore() },
}));
```

See [linforge-adapter-prisma](https://www.npmjs.com/package/linforge-adapter-prisma) for a reference implementation.

## Examples

- **[Quick Start](https://github.com/lukelelekul/linforge/tree/master/examples/quick-start)** — Minimal server (~30 lines)
- **[Full Stack](https://github.com/lukelelekul/linforge/tree/master/examples/full-stack)** — Manual assembly with all components

## License

MIT
