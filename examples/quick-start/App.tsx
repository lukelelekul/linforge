// Linforge Quick Start — 前端
//
// LinforgeWorkbench 是开箱即用的全功能工作台组件。

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
