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
linforge/server   — Koa HTTP 路由 (mountRoutes)
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
│   ├── PromptLoader.ts       — Prompt 加载 + 内存缓存
│   ├── TemplateRegistry.ts   — 图模板注册表
│   ├── applyTemplate.ts      — 模板应用到图 (追加合并)
│   ├── builtinTemplates.ts   — 内置模板 (ReAct, Pipeline, MapReduce, HITL)
│   ├── stateSanitizer.ts     — 状态清理工具
│   └── index.ts              — core 模块导出
├── server/
│   ├── router.ts             — mountRoutes() — 15 个 REST 端点
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
├── server.ts                     — 完整后端示例
```

## 三层架构

```
Layer 1 (Code):   Node impl + StateSchema + Route functions     [developer]
Layer 2 (Visual): Topology + Wiring + Prompt + Parameters       [canvas/DB]
Layer 3 (Auto):   GraphCompiler combines L1 + L2 -> Runnable    [linforge]
```

## 核心 Store 接口 (DAO 层)

4 个接口定义在 `src/core/types.ts`，是数据库无关的抽象层。
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
  listRuns(graphSlug: string, opts?: { limit?: number; offset?: number }): Promise<RunRecord[]>;
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

## 核心数据实体

### GraphDefinition

```typescript
{ id, slug, name, icon?, nodes: GraphNodeDef[], edges: GraphEdgeDef[] }
```

### RunRecord

```typescript
{ id, graphSlug, status, input?, result?, tokensUsed, startedAt, finishedAt? }
```

### StepData

```typescript
{ agentRunId, nodeId, stepNumber, input, output, durationMs, tokensUsed, toolName?, stateBefore?, stateAfter? }
```

### PromptVersion

```typescript
{ id, template, temperature, nodeId, version, isActive, createdAt }
```

## Server 路由 (mountRoutes)

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
