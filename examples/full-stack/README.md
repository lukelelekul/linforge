# Linforge Full-Stack Example

A minimal full-stack example demonstrating Linforge integration with Koa (server) and React (frontend).

## What's included

- **Server** (`server.ts`): 3 example nodes (planner, tools, summarizer), Memory Stores, seed graph, Koa + Linforge routes
- **Frontend** (`App.tsx`): `<LinforgeWorkbench>` one-line integration

## Run

```bash
pnpm install
pnpm dev
```

This starts:

- Server at `http://localhost:3001` (API prefix: `/linforge`)
- Frontend at `http://localhost:5180`

Open `http://localhost:5180` in your browser.

## Try it

1. **Blueprint mode**: Click the seed graph "Example Agent" to open the canvas. Drag nodes, edit properties, manage prompts.
2. **Run**: Enter an instruction and click "Run" to trigger the agent. Watch the step timeline.
3. **Templates**: Create a new graph and apply a built-in template (ReAct, Pipeline, etc.).
