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
- **Koa server routes** — `mountRoutes()` adds 15 REST endpoints for graph, run, prompt, and template management

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
import Router from '@koa/router';
import {
  NodeRegistry,
  defineNode,
  RunManager,
  GraphCompiler,
} from 'linforge/core';
import { mountRoutes } from 'linforge/server';
import {
  MemoryGraphStore,
  MemoryRunStore,
  MemoryStepPersister,
  MemoryPromptStore,
} from 'linforge/testing';

// Define nodes
const greeter = defineNode({
  name: 'greeter',
  description: 'Says hello',
  execute: async (state) => ({ ...state, message: 'Hello!' }),
});

// Set up registry
const registry = new NodeRegistry();
registry.register(greeter);

// Mount routes
const app = new Koa();
const router = new Router();

mountRoutes(router, {
  registry,
  graphStore: new MemoryGraphStore(),
  runStore: new MemoryRunStore(),
  stepPersister: new MemoryStepPersister(),
  promptStore: new MemoryPromptStore(),
  compilerFactory: (reg) => new GraphCompiler(reg),
  runManagerFactory: (compiler) => new RunManager(compiler),
});

app.use(router.routes());
app.listen(3001);
```

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
| `NodeRegistry`         | Register/discover nodes                           |
| `GraphCompiler`        | Compile graph definitions to LangGraph StateGraph |
| `RunManager`           | Execute graphs with abort, steps, and callbacks   |
| `createPromptLoader()` | Store-backed prompt loading with cache            |
| `TemplateRegistry`     | Register and list graph templates                 |
| `applyTemplate()`      | Instantiate a template into a graph definition    |
| `withStepRecording()`  | Wrap node functions for automatic step recording  |

### Server

| Export                      | Description                          |
| --------------------------- | ------------------------------------ |
| `mountRoutes(router, opts)` | Mount 15 REST routes on a Koa router |

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
