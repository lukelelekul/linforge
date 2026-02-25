// Linforge Full-Stack Example — Frontend
//
// LinforgeWorkbench is the all-in-one component that provides:
//   - Graph list view (create, rename, delete graphs)
//   - Graph canvas editor (drag nodes, connect edges, edit properties)
//   - Run & replay panel (trigger runs, view step-by-step execution)
//   - Prompt editor (view/edit LLM prompts per node)
//   - Template gallery (apply built-in graph templates)
//
// Only two props needed:
//   - apiBase: URL prefix for Linforge API (must match server's prefix)
//   - basePath: client-side route prefix for internal navigation

import { LinforgeWorkbench } from 'linforge/react';
import '@xyflow/react/dist/style.css';

export default function App() {
  return (
    <LinforgeWorkbench
      apiBase="http://localhost:3001/linforge"
      basePath="/linforge"
    />
  );
}
