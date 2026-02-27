# Linforge 架构参考

> 详细的模块结构、文件职责、接口定义，供 AI 辅助开发时参考。
> 设计理念和产品定位请参见 [agent-studio.md](./agent-studio.md)。

## 项目定位

Linforge 是一个可嵌入的 LangGraph Agent 应用开发工作台。
核心理念：**画布设计拓扑 + 代码实现逻辑**，编译器自动组装为可执行图。

## 技术栈

- **语言**: TypeScript (ES2023, strict)
- **构建**: tsup (ESM + CJS 双格式输出)
- **测试**: vitest
- **运行时依赖**: `@langchain/core`, `@langchain/langgraph`, `zod`
- **可选 peer**: Koa (server), React + @xyflow/react (UI)

## 包导出结构

```
linforge          — 总入口 (re-export 全部子模块)
linforge/core     — 核心逻辑 (defineNode, Registry, Compiler, RunManager...)
linforge/server   — Koa HTTP API (linforgeMiddleware + mountRoutes)
linforge/react    — React hooks + UI 工具
linforge/testing  — 内存 Store 实现 (开发/测试用)
```

## 目录结构

```
src/
├── index.ts                  — 包入口，re-export 子模块
├── core/
│   ├── types.ts              — 所有核心类型和接口定义
│   ├── defineNode.ts         — defineNode() 工厂函数
│   ├── NodeRegistry.ts       — 节点注册表 (key -> NodeDefinition)
│   ├── GraphCompiler.ts      — 图编译器 (GraphDef + Registry -> Runnable)
│   ├── RunManager.ts         — 运行生命周期管理 (启动/超时/取消)
│   ├── StepRecorder.ts       — 步骤自动记录包装器
│   ├── PromptLoader.ts       — Prompt 加载 + Mustache 渲染 + 内存缓存
│   ├── TemplateRegistry.ts   — 图模板注册表
│   ├── applyTemplate.ts      — 模板应用到图 (追加合并)
│   ├── builtinTemplates.ts   — 内置模板 (ReAct, Pipeline, MapReduce, HITL)
│   ├── stateSanitizer.ts     — 状态清理工具
│   └── index.ts              — core 模块导出
├── server/
│   ├── middleware.ts         — linforgeMiddleware() — 一行接入后端
│   ├── router.ts             — createLinforgeRouter() + mountRoutes() — 16 个 REST 端点
│   └── index.ts              — server 模块导出
├── react/
│   ├── useLinforgeGraph.ts       — 图编辑 hook
│   ├── useLinforgeGraphList.ts   — 图列表 hook
│   ├── useLinforgeRuns.ts        — 运行管理 hook
│   ├── useLinforgePrompt.ts      — Prompt 版本管理 hook
│   ├── useInternalRouter.ts      — 内部路由 hook
│   ├── graphLayout.ts            — 自动布局算法
│   ├── stateDiff.ts              — 状态差异对比
│   ├── formatUtils.ts            — 格式化工具
│   ├── icons.ts                  — 图标映射
│   └── index.ts                  — react 模块导出
├── testing/
│   ├── MemoryGraphStore.ts       — GraphStore 内存实现
│   ├── MemoryRunStore.ts         — RunStore 内存实现
│   ├── MemoryStepPersister.ts    — StepPersister 内存实现
│   ├── MemoryPromptStore.ts      — PromptStore 内存实现
│   └── index.ts                  — testing 模块导出
├── __tests__/                    — 测试文件
examples/
├── quick-start/                  — 最小全栈示例 (~30 行后端)
├── full-stack/                   — 完整手动组装示例 (~240 行后端)
```

## 三层架构

```
Layer 1 (Code):   Node impl + StateSchema + Route functions     [developer]
Layer 2 (Visual): Topology + Wiring + Prompt + Parameters       [canvas/DB]
Layer 3 (Auto):   GraphCompiler combines L1 + L2 -> Runnable    [linforge]
```

## 核心 Store 接口 (DAO 层)

4 个接口定义在 `packages/linforge/src/core/types.ts`，是数据库无关的抽象层。
项目内置 Memory 实现用于开发测试，生产环境由用户或 adapter 包实现。

### GraphStore — 图定义存储

```typescript
interface GraphStore {
  getGraph(slug: string): Promise<GraphDefinition | null>;
  saveGraph(graph: GraphDefinition): Promise<void>;
  listGraphs(): Promise<GraphDefinition[]>;
}
```

### RunStore — 运行记录存储

```typescript
interface RunStore {
  createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(graphSlug: string, opts?: { limit?: number; offset?: number; metadata?: Record<string, unknown> }): Promise<RunRecord[]>;
  updateRunStatus(runId: string, status: RunRecord['status'], data?: Record<string, unknown>): Promise<void>;
}
```

### StepPersister — 步骤持久化

```typescript
interface StepPersister {
  createStep(data: StepData): Promise<void>;
  getSteps(runId: string): Promise<StepData[]>;
}
```

### PromptStore — Prompt 版本管理

```typescript
interface PromptStore {
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  listVersions(nodeId: string): Promise<PromptVersion[]>;
  createVersion(nodeId: string, data: CreatePromptVersionInput): Promise<PromptVersion>;
  activateVersion(nodeId: string, versionId: string): Promise<void>;
}
```

### PromptLoader — Prompt 加载与渲染

基于内存缓存的 Prompt 加载器，支持 Mustache 模板渲染。

```typescript
interface PromptLoader {
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  invalidateCache(nodeId?: string): void;
  render(nodeId: string, vars: Record<string, unknown>, fallback?: PromptFallback): Promise<RenderResult>;
}

interface RenderResult {
  text: string;           // 渲染后的模板文本
  temperature: number;    // LLM 温度参数
  source: 'store' | 'fallback';
}

interface PromptFallback {
  template: string;
  temperature?: number;   // 默认 0.7
}

// 纯函数 — 独立的 Mustache 渲染（禁用 HTML 转义）
function renderPrompt(template: string, vars: Record<string, unknown>): string;
```

- `createPromptLoader(store)` 创建带缓存的加载器实例
- `render()` 通过 `getActivePrompt()` 加载激活版本，用 Mustache 渲染变量；无激活版本时使用 `fallback.template`
- `renderPrompt()` 是纯函数，可脱离 PromptStore 独立使用

## 核心数据实体

### GraphDefinition

```typescript
{ id, slug, name, icon?, nodes: GraphNodeDef[], edges: GraphEdgeDef[] }
```

### RunRecord

```typescript
{ id, graphSlug, status, input?, result?, metadata?, tokensUsed, startedAt, finishedAt? }
```

`metadata` 是可选的 `Record<string, unknown>`，用于透传业务上下文（userId、tenantId、source 等）。

### StepData

```typescript
{ agentRunId, nodeId, stepNumber, input, output, durationMs, tokensUsed, toolName?, stateBefore?, stateAfter? }
```

### PromptVersion

```typescript
{ id, template, temperature, nodeId, version, isActive, createdAt }
```

## Server 接入

### linforgeMiddleware（推荐）

一行接入后端。自动创建 Registry、Compiler、RunManager、TemplateRegistry 和 Memory Stores。同时自动检测并注入 `agentRunId` 到 StateSchema。

```typescript
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { linforgeMiddleware } from 'linforge/server';

const app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [planner, tools, summarizer],
}));
app.listen(3001);
```

配置项：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stateSchema` | StateSchema | — | 单 Agent 模式：LangGraph StateSchema 实例 |
| `nodes` | NodeDefinition[] | — | 单 Agent 模式：defineNode() 创建的节点数组 |
| `agents` | AgentConfig[] | — | 多 Agent 模式：每个 Agent 的配置（slug、name、stateSchema、nodes） |
| `sharedNodes` | NodeDefinition[] | `[]` | 多 Agent 模式：注册到每个 agent 的公共节点 |
| `prefix` | string | `"/linforge"` | 路由前缀 |
| `stores` | object | Memory* 默认值 | 自定义 Store 实现 (graphStore, runStore, stepPersister, promptStore) |
| `buildInput` | function | `(i) => ({ instruction: i })` | 将 instruction 转换为图输入 |
| `stepRecordingDebug` | boolean | `false` | 记录完整 state 快照 |
| `templates` | GraphTemplate[] | `[]` | 追加到内置模板的自定义模板 |
| `disableBuiltinTemplates` | boolean | `false` | 禁用内置模板 |

> `stateSchema` + `nodes`（单 Agent）和 `agents`（多 Agent）二选一。使用 `agents` 时，每个 agent 拥有独立的 `NodeRegistry` 和 `GraphCompiler`，middleware 首次请求时自动同步 GraphStore（code-first 模式）。

#### 多 Agent 模式

```typescript
app.use(linforgeMiddleware({
  agents: [
    { slug: 'qa-bot', name: 'QA Bot', stateSchema: QAState, nodes: [retriever, answerer] },
    { slug: 'coder', name: 'Coder', stateSchema: CoderState, nodes: [planner, coder] },
  ],
  sharedNodes: [logger],
}));
```

多 Agent 模式下：
- 每个 agent 的 `stateSchema` 独立注入 `agentRunId`
- 路由通过 `:slug` 参数解析 agent 上下文，单 Agent 模式降级到通配符 `'*'`
- `GET /graphs` 返回 `codeFirst: true`；`POST /graphs` 返回 403（Graph 由代码注册）
- 首次请求时，middleware 为 GraphStore 中不存在的 agent slug 自动创建空拓扑

### mountRoutes（底层 API）

供需要完全控制组件创建的用户使用。`linforgeMiddleware` 内部调用此函数。

`mountRoutes(app, options)` 在 Koa 应用上注册以下端点 (默认前缀 `/linforge`):

| 方法 | 路径 | 说明 | 依赖 Store |
|------|------|------|-----------|
| GET | /graphs | 图列表 (compact) | GraphStore |
| POST | /graphs | 创建新图 | GraphStore |
| PATCH | /graphs/:slug | 编辑图基本信息 | GraphStore |
| GET | /registry/nodes | 已注册节点列表 | NodeRegistry |
| GET | /graph/:slug | 获取图定义 | GraphStore |
| PUT | /graph/:slug | 保存图定义 | GraphStore |
| POST | /graph/:slug/run | 触发运行 | RunStore, RunManager |
| GET | /graph/:slug/runs | 运行历史 (分页) | RunStore |
| GET | /runs/:runId | 运行详情 | RunStore |
| GET | /runs/:runId/steps | 步骤列表 | StepPersister |
| GET | /prompts/:nodeId | Prompt 版本列表 | PromptStore |
| GET | /prompts/:nodeId/active | 当前激活版本 | PromptStore |
| POST | /prompts/:nodeId | 创建新版本 | PromptStore |
| POST | /prompts/:nodeId/versions/:id/activate | 激活版本 | PromptStore |
| GET | /templates | 可用模板列表 | TemplateRegistry |
| POST | /graph/:slug/apply-template | 应用模板到图 | GraphStore, TemplateRegistry |

## 开发命令

```bash
pnpm run build        # tsup 构建
pnpm run typecheck    # tsc --noEmit 类型检查
pnpm run test         # vitest run
pnpm run test:watch   # vitest watch 模式
```
