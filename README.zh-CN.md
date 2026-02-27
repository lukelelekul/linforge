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
- **多 Agent 模式** — 通过 `agents` 配置为每个 Agent 绑定独立的 `stateSchema` 和 `nodes`；code-first 自动同步 GraphStore
- **Run metadata 透传** — 传入业务上下文（userId、tenantId、source），贯穿运行生命周期，支持按 metadata 过滤
- **Koa 服务端路由** — `linforgeMiddleware()` 一行接入，或 `mountRoutes()` 完全控制 — 16 条 REST 端点

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
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNodeFor } from 'linforge/core';
import { linforgeMiddleware } from 'linforge/server';

// 定义 State
const MyState = new StateSchema({
  messages: z.array(z.string()).default([]),
  result: z.string().default(''),
});

// 定义节点（自动推导 state 类型）
const defineMyNode = defineNodeFor(MyState);

const greeter = defineMyNode({
  key: 'greeter',
  label: 'Greeter',
  run: async (state) => ({
    messages: [...state.messages, 'Hello!'],
    result: 'Greeting complete.',
  }),
});

// 启动服务器 — linforgeMiddleware 自动处理一切
const app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [greeter],
}));
app.listen(3001);
```

> 需要完全控制？使用 `mountRoutes()` 手动组装 — 参见 [examples/full-stack/](examples/full-stack/)

#### 多 Agent 模式

当多个 Agent 需要不同的 state schema 或节点实现时，使用 `agents` 配置：

```ts
app.use(linforgeMiddleware({
  agents: [
    { slug: 'qa-bot', name: 'QA Bot', stateSchema: QAState, nodes: [retriever, answerer] },
    { slug: 'coder', name: 'Coder', stateSchema: CoderState, nodes: [planner, coder] },
  ],
  sharedNodes: [logger],  // 注册到所有 agent 的公共节点
}));
```

每个 agent 拥有独立的 `NodeRegistry`、`GraphCompiler` 和 `stateSchema`。middleware 首次请求时自动在 GraphStore 中为每个 agent 创建空拓扑。

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
| `defineNode(options)`   | 创建类型化的节点定义                                |
| `defineNodeFor(schema)` | 创建绑定 StateSchema 的 `defineNode`（自动推导 state 类型） |
| `InferState<T>`         | 工具类型：从 StateSchema 提取完整 state 类型        |
| `InferUpdate<T>`        | 工具类型：从 StateSchema 提取 partial update 类型   |
| `NodeRegistry`          | 注册和发现节点                                      |
| `GraphCompiler`         | 将图定义编译为 LangGraph StateGraph                 |
| `RunManager`            | 执行图，支持中断、步骤记录和回调                    |
| `createPromptLoader()`  | 基于 Store 的 Prompt 加载器（带缓存和 Mustache 渲染）|
| `renderPrompt()`        | 纯函数：Mustache 模板渲染（禁用 HTML 转义）         |
| `TemplateRegistry`      | 注册和列举图模板                                    |
| `applyTemplate()`       | 将模板实例化为完整的图定义                          |
| `withStepRecording()`   | 包装节点函数，自动记录执行步骤                      |

### Server

| 导出                         | 说明                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `linforgeMiddleware(opts)`   | 一行接入 Koa 中间件 — 自动创建 Registry、Compiler、RunManager、Stores（推荐） |
| `mountRoutes(router, opts)`  | 在 Koa Router 上挂载 16 条路由（底层 API）                            |
| `AgentConfig`                | 类型：单个 Agent 的配置（slug、name、stateSchema、nodes）             |
| `AgentContext`               | 类型：按 slug 解析的运行时上下文（registry、compiler、stateSchema、buildInput） |

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

## 生产持久化

生产环境中，使用 Prisma adapter 替换内存 Store：

```bash
npm install linforge-adapter-prisma @prisma/client
```

```ts
import { createPrismaStores } from 'linforge-adapter-prisma';
import { PrismaClient } from '@prisma/client';

const stores = createPrismaStores(new PrismaClient());
```

详见 [`linforge-adapter-prisma`](./packages/adapter-prisma/)。

## 详细设计文档

完整的架构设计和 API 规范请参考 [agent-studio.md](./docs/agent-studio.md)。

## 许可证

[MIT](./LICENSE)
