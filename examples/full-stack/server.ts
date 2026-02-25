// Linforge Full-Stack Example — Server
//
// Demonstrates the complete Linforge setup:
//   1. Define a LangGraph StateSchema (with agentRunId for step recording)
//   2. Create nodes via defineNode() and register them
//   3. Wire up Memory Stores (swap with DB adapters in production)
//   4. Seed an initial graph definition
//   5. Start a Koa server with mountRoutes() — one call exposes all APIs

import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import {
  defineNode,
  NodeRegistry,
  GraphCompiler,
  RunManager,
  TemplateRegistry,
  builtinTemplates,
} from 'linforge/core';
import { mountRoutes } from 'linforge/server';
import {
  MemoryGraphStore,
  MemoryRunStore,
  MemoryStepPersister,
  MemoryPromptStore,
} from 'linforge/testing';
import type { GraphDefinition } from 'linforge/core';

// ============================================================
// 1. State Schema
// ============================================================
// Define your LangGraph state using StateSchema + Zod v4.
// IMPORTANT: `agentRunId` is required for Linforge step recording.
// The router auto-injects a runId into this field before each run.
// Without it, steps won't be recorded and replay mode won't work.

const ExampleState = new StateSchema({
  messages: z.array(z.string()).default([]),
  plan: z.string().default(''),
  results: z.array(z.string()).default([]),
  summary: z.string().default(''),
  agentRunId: z.string().default(''),
});

// ============================================================
// 2. Define Nodes
// ============================================================
// Each node is created with defineNode({ key, run, ... }).
// - `key` must match the node key in the graph definition
// - `run(state)` receives the current state, returns partial updates
// - `routes` (optional) defines conditional edge predicates
// - `summarizeOutput` (optional) customizes step output for the UI

const planner = defineNode({
  key: 'planner',
  label: 'Planner',
  run: async (state: any) => {
    await sleep(500);
    return {
      plan: 'Step 1: Fetch data. Step 2: Analyze. Step 3: Summarize.',
      messages: [...state.messages, '[planner] Plan created'],
    };
  },
  // Routes enable conditional edges in the graph.
  // Each key is a route name, the value is a predicate on state.
  // The graph editor maps route keys to target nodes via routeMap.
  routes: {
    has_plan: (state: any) => !!state.plan,
  },
});

const tools = defineNode({
  key: 'tools',
  label: 'Tool Executor',
  run: async (state: any) => {
    await sleep(300);
    return {
      results: ['Result from API call', 'Result from database query'],
      messages: [...state.messages, '[tools] Fetched 2 results'],
    };
  },
});

const summarizer = defineNode({
  key: 'summarizer',
  label: 'Summarizer',
  run: async (state: any) => {
    await sleep(400);
    const summary = `Summary: processed ${state.results.length} results based on plan.`;
    return {
      summary,
      messages: [...state.messages, `[summarizer] ${summary}`],
    };
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 3. Registry & Stores
// ============================================================
// NodeRegistry: registers node implementations for graph compilation.
// Stores: pluggable persistence layer. Use Memory* for dev/testing,
// implement the Store interfaces (GraphStore, RunStore, etc.) with
// your DB (Prisma, Drizzle, etc.) for production.

const registry = new NodeRegistry();
registry.register(planner);
registry.register(tools);
registry.register(summarizer);

const graphStore = new MemoryGraphStore();
const runStore = new MemoryRunStore();
const stepPersister = new MemoryStepPersister();
const promptStore = new MemoryPromptStore();

const compiler = new GraphCompiler(registry);
const runManager = new RunManager();

// Built-in templates (ReAct Agent, Pipeline, etc.) for the template gallery
const templateRegistry = new TemplateRegistry();
builtinTemplates.forEach((t) => templateRegistry.register(t));

// ============================================================
// 4. Seed graph
// ============================================================
// A graph definition describes the visual layout + topology.
// - `nodes[].key` must match a registered node key (or be __start__/__end__)
// - `nodes[].hasPrompt: true` enables the Prompt editor in the UI
// - `edges[].sourceHandle / targetHandle` control connection points
//   Available handles: top, top-out, bottom, bottom-in, left, left-out, right, right-in

const seedGraph: GraphDefinition = {
  id: 'seed-001',
  slug: 'example-agent',
  name: 'Example Agent',
  nodes: [
    {
      key: '__start__',
      label: 'START',
      position: { x: -394, y: 582 },
    },
    {
      key: 'planner',
      label: 'Planner',
      description: 'Creates an execution plan',
      icon: 'sparkles',
      position: { x: -235, y: 544 },
      hasPrompt: true,
    },
    {
      key: 'tools',
      label: 'Tool Executor',
      description: 'Executes tools and fetches data',
      icon: 'wrench',
      position: { x: 130, y: 544 },
    },
    {
      key: 'summarizer',
      label: 'Summarizer',
      description: 'Summarizes collected results',
      icon: 'file-text',
      position: { x: 476, y: 544 },
      hasPrompt: true,
    },
    {
      key: '__end__',
      label: 'END',
      position: { x: 816, y: 582 },
    },
  ],
  edges: [
    {
      source: '__start__',
      target: 'planner',
      sourceHandle: 'right',
      targetHandle: 'left',
    },
    {
      source: 'planner',
      target: 'tools',
      sourceHandle: 'right-in',
      targetHandle: 'left',
    },
    {
      source: 'tools',
      target: 'summarizer',
      sourceHandle: 'right-in',
      targetHandle: 'left',
    },
    {
      source: 'summarizer',
      target: '__end__',
      sourceHandle: 'right-in',
      targetHandle: 'left',
    },
  ],
};

graphStore.saveGraph(seedGraph);

// ============================================================
// 5. Start Server
// ============================================================
// mountRoutes() registers all Linforge API endpoints on the Koa app:
//   - Graph CRUD (list, get, save, apply template)
//   - Run lifecycle (trigger, list, detail, steps)
//   - Prompt management (list versions, create, activate)
//   - Node registry (list registered nodes)
//
// Passing stepPersister automatically enables step recording.
// Passing promptStore enables the Prompt editor API.

const app = new Koa();
app.use(cors());
app.use(bodyParser());

mountRoutes(app, {
  registry,
  compiler,
  graphStore,
  runManager,
  runStore,
  stepPersister,
  promptStore,
  templateRegistry,
  stateSchema: ExampleState,
  prefix: '/linforge',
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Linforge example server running at http://localhost:${PORT}`);
  console.log(`API prefix: /linforge`);
});
