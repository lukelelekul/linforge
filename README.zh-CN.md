# Linforge

[English](./README.md)

可嵌入的 [LangGraph](https://langchain-ai.github.io/langgraphjs/) Agent 工作台 — 编辑、运行、调试、监控，一站搞定。

> 由 [LianBuilds](https://github.com/LianBuilds) 开发

## 特性

- **可视化图编辑器** — 拖拽节点、智能边路由、蓝图模式与回放模式
- **Prompt 版本管理** — 按节点编辑、保存、激活 Prompt 模板，完整版本历史
- **运行与回放** — 触发 Agent 运行，逐步查看执行时间线与状态变更
- **模板系统** — 4 个内置图模板（ReAct、Pipeline、Map-Reduce、Human-in-the-Loop）
- **Store 接口** — 可插拔的持久化层：`GraphStore`、`RunStore`、`StepPersister`、`PromptStore`
- **一行集成** — `<LinforgeWorkbench>` 组件将完整工作台嵌入任意 React 应用
- **Koa 服务端路由** — `mountRoutes()` 挂载 15 条 REST 端点，覆盖图、运行、Prompt、模板管理

## 快速上手

### 1. 安装

```bash
npm install linforge
# 按需安装 peer dependencies
npm install react react-dom @xyflow/react koa @koa/router
```

### 2. 服务端

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

// 定义节点
const greeter = defineNode({
  name: 'greeter',
  description: 'Says hello',
  execute: async (state) => ({ ...state, message: 'Hello!' }),
});

// 注册节点
const registry = new NodeRegistry();
registry.register(greeter);

// 挂载路由
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

### 3. 前端

```tsx
import { LinforgeWorkbench } from 'linforge/react';
import '@xyflow/react/dist/style.css';

function App() {
  return (
    <LinforgeWorkbench apiBase="http://localhost:3001" basePath="/linforge" />
  );
}
```

## 子路径导入

| 导入路径           | 说明                          |
| ------------------ | ----------------------------- |
| `linforge`         | 重导出所有子模块              |
| `linforge/core`    | 节点定义、注册、编译、运行    |
| `linforge/server`  | Koa 路由挂载                  |
| `linforge/react`   | React 组件和 Hooks            |
| `linforge/testing` | 内存 Store 适配器（用于测试） |

## Peer Dependencies

| 包名            | 版本                   | 用于              |
| --------------- | ---------------------- | ----------------- |
| `react`         | `^18.0.0 \|\| ^19.0.0` | `linforge/react`  |
| `react-dom`     | `^18.0.0 \|\| ^19.0.0` | `linforge/react`  |
| `@xyflow/react` | `^12.0.0`              | `linforge/react`  |
| `koa`           | `^3.0.0`               | `linforge/server` |
| `@koa/router`   | `^15.0.0`              | `linforge/server` |

所有 peer dependencies 均为可选，按需安装即可。

> **注意：** 使用 `linforge/react` 时，需要引入 React Flow 样式表：
>
> ```ts
> import '@xyflow/react/dist/style.css';
> ```

## 核心概念

### 分层混合架构

Linforge 采用三层架构，兼顾灵活性与可执行性：

- **Code 层** — 开发者用 `defineNode()` 注册节点，业务逻辑保留在代码中
- **Visual 层** — 在画布上拖拽连线、配置边条件、编辑 Prompt 模板
- **Compiler 层** — `GraphCompiler` 将画布定义编译为可执行的 LangGraph StateGraph

### 节点类型

- **Bound 节点** — 已绑定 `defineNode()` 实现的节点，可直接参与编译和执行
- **Skeleton 节点** — 画布上的占位节点，需要开发者编写代码实现后绑定

## API 概览

### Core

| 导出                   | 说明                                  |
| ---------------------- | ------------------------------------- |
| `defineNode(options)`  | 创建类型化的节点定义                  |
| `NodeRegistry`         | 注册和发现节点                        |
| `GraphCompiler`        | 将图定义编译为 LangGraph StateGraph   |
| `RunManager`           | 执行图，支持中断、步骤记录和回调      |
| `createPromptLoader()` | 基于 Store 的 Prompt 加载器（带缓存） |
| `TemplateRegistry`     | 注册和列举图模板                      |
| `applyTemplate()`      | 将模板实例化为完整的图定义            |
| `withStepRecording()`  | 包装节点函数，自动记录执行步骤        |

### Server

| 导出                        | 说明                           |
| --------------------------- | ------------------------------ |
| `mountRoutes(router, opts)` | 在 Koa Router 上挂载 15 条路由 |

### React

| 导出                  | 说明                                 |
| --------------------- | ------------------------------------ |
| `<LinforgeWorkbench>` | 一体化工作台（图列表 + 画布 + 运行） |
| `<GraphCanvas>`       | 图编辑器（蓝图模式 + 回放模式）      |
| `<RunPanel>`          | 运行触发、历史记录、步骤时间线       |
| `<PromptEditor>`      | Prompt 模板编辑（含版本管理）        |
| `<NodePropertyPanel>` | 节点属性内联编辑                     |
| `<StepDetailPanel>`   | 步骤执行详情（含 State Diff）        |
| `useLinforgeGraph()`  | 图数据获取与变更 Hook                |
| `useLinforgeRuns()`   | 运行管理与步骤轮询 Hook              |
| `useLinforgePrompt()` | Prompt 版本 CRUD Hook                |

### Testing

| 导出                  | 说明             |
| --------------------- | ---------------- |
| `MemoryGraphStore`    | 内存图存储       |
| `MemoryRunStore`      | 内存运行存储     |
| `MemoryStepPersister` | 内存步骤持久化   |
| `MemoryPromptStore`   | 内存 Prompt 存储 |

## 详细设计文档

完整的架构设计和 API 规范请参考 [agent-studio.md](./agent-studio-zh-CN.md)。

## 许可证

[MIT](./LICENSE)
