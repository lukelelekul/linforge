# Linforge — 设计讨论记录

> **Linforge** — LangGraph Agent 应用的嵌入式开发工作台
> 从 ContentRadar 项目中孵化，由 LianBuilds 维护
> 讨论开始：2026-02-23
> 交互原型：`./agent-studio-prototype.html`（Blueprint + 运行调试双模式）

## 产品定位

**Linforge** 是 LangGraph Agent 应用的嵌入式开发工作台，集编辑、运行、调试、监控于一体。

与 LangGraph Studio 官方的差异：

- Web 嵌入式（非桌面应用），可集成到产品 UI 中
- Prompt 在线编辑 + 版本管理（官方没有）
- Studio 内直接触发运行和查看结果（改 prompt → 运行 → 看结果 → 再改的迭代循环）
- **有限图编排**：在画布上连线和配置，无需改代码重启
- **产品+开发协作**：产品先画图定流程，开发再填实现
- 生产环境监控能力（不仅是开发调试）
- 中文生态友好

## 核心架构：分层混合（Code + Visual）

三层分离，各司其职：

```
Layer 1 (Code - developer):     Node impl + State schema + Route functions
Layer 2 (Visual - dev/product): Topology + Wiring + Prompt + Parameters (DB-backed)
Layer 3 (Toolkit - auto):       Compiler combines L1 + L2 into executable graph
```

> **说明**：产品和开发先在画布上协作定义图拓扑（skeleton 节点），开发再写代码绑定实现，之后在 Studio 里配 Prompt、调参数、运行调试，全部可视化完成。

### 设计原则

- **图拓扑在画布上设计**（DB 存储）— 产品和开发可协作，先画图后填代码
- **节点实现是代码**（注册制）— 避免 Low-code 的表达力限制
- **条件路由函数是代码注册的**（DB 只存 key）— 避免表达式引擎的复杂度
- **State schema 是代码定义的** — 跟业务数据结构绑定，不需要可视化定义
- **Compiler 复杂度可控** — 组装 addNode/addEdge/addConditionalEdges + 可选的 StepRecording 自动注入

### 为什么不做纯 code-first

- `graph.ts` 纯代码编排不直观，改一条边要改代码 + 重启
- 开发过程中调整图结构的频率很高（尤其是 Prompt 迭代期）
- 非开发者（产品经理）无法参与图结构讨论

### 为什么不做纯 visual（Dify/Coze 模式）

- 节点类型也要可视化定义，复杂度指数级上升
- 复杂逻辑（state reducer、channel 机制）难以用表单表达
- 自定义节点要走插件机制，开发体验差

### 主流工具参考

| 工具             | 构建方式                          | 编排          | 执行                   | 局限             |
| ---------------- | --------------------------------- | ------------- | ---------------------- | ---------------- |
| Dify / Coze      | 纯可视化拖拽                      | UI            | UI 定义直接执行        | 复杂逻辑表达困难 |
| LangGraph Studio | 代码定义 + 可视化查看             | Code          | Code                   | 改图要改代码重启 |
| ComfyUI          | 可视化编辑，面向懂技术用户        | UI            | JSON workflow          | 节点类型固定     |
| Rivet            | 可视化编辑 → 导出 JSON → 代码加载 | UI            | JSON definition        | 生态较小         |
| n8n / Prefect    | 可视化 DAG + 代码节点             | UI            | DB definition          | 不是 Agent 专用  |
| **我们的方案**   | **画布画图 + 代码填实现**         | **UI + Code** | **DB def + Code impl** | —                |

## 协作工作流：先画图，后填代码

### 四阶段流程

```
Phase 1 - Design (product + dev, in Studio):
  Pick a template or start blank
  Drag skeleton nodes onto canvas, name them, write descriptions
  Wire edges (conditional edges marked as "pending")
  Result: graph topology in DB, no code behind it

Phase 2 - Implement (dev, in code):
  See skeleton nodes listed in Studio (gray/dashed = unbound)
  Write node functions with defineNode({ key: '...' })
  Studio auto-matches by key, nodes turn active (bound)
  Register route functions for conditional edges

Phase 3 - Configure (dev/product, in Studio):
  Write Prompts for LLM nodes
  Set parameters (temperature, limits, etc.)
  All in Studio UI, no code changes

Phase 4 - Run & Debug (in Studio):
  Trigger runs, inspect steps, iterate on Prompts
  Compare runs, tune parameters
  No restart needed
```

> **说明**：Phase 1 产品和开发协作画图；Phase 2 开发写代码绑定节点；Phase 3 在 Studio 配置；Phase 4 在 Studio 运行调试

### 节点的两种状态

| 状态                   | 含义                  | 画布表现      | 能否运行 |
| ---------------------- | --------------------- | ------------- | -------- |
| **Skeleton**（未绑定） | 只有 meta，无代码实现 | 灰色/虚线边框 | 不能     |
| **Bound**（已绑定）    | meta + 代码实现已注册 | 正常显示      | 能       |

- 画布上全部节点 bound 后，图才能 compile 和运行
- 点运行时若有 skeleton 节点，提示"以下节点未实现：xxx, yyy"
- 条件边同理：未绑定路由函数的条件边标记为 "pending"

### 预置图模板

从空白画布开始太慢，套件提供常见 Agent 模式的模板作为起点。

#### 内置模板

| 模板              | 节点                                                  | 场景             |
| ----------------- | ----------------------------------------------------- | ---------------- |
| ReAct Agent       | planner → tools → processResults → checkLimits (loop) | 工具调用型 Agent |
| Pipeline          | step1 → step2 → step3 → save                          | 线性处理管线     |
| Map-Reduce        | split → 3 parallel workers → merge → output           | 并行处理         |
| Human-in-the-loop | agent → review → (approve/reject) → ...               | 需要人工审核     |

#### 模板数据格式

模板是纯拓扑描述（无 position），由自动布局算法计算节点位置：

```ts
interface GraphTemplate {
  id: string; // 'react-agent' | 'pipeline' | ...
  name: string; // 显示名 '工具调用型 Agent'
  description: string; // 一句话说明场景
  category?: string; // 分类标签，如 'agent' | 'pipeline' | 'pattern'
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

interface TemplateNode {
  key: string; // skeleton 节点 key
  label: string;
  description?: string;
  icon?: string; // Lucide icon 名（应用到 GraphNodeDef.icon）
  color?: string; // 节点颜色类名（应用到 GraphNodeDef.color）
}

interface TemplateEdge {
  source: string; // node key
  target: string; // node key
  routeMap?: Record<string, string>; // 条件边
  label?: string;
}
```

#### 模板注册

内置 4 个模板硬编码在 `core` 包中导出，不存 DB。宿主项目通过 `TemplateRegistry` 实例注册自定义模板：

```ts
import { TemplateRegistry, builtinTemplates } from '@linforge/core';

const templateRegistry = new TemplateRegistry();
// 注册内置模板
templateRegistry.registerAll(builtinTemplates);

// 注册宿主自定义模板
templateRegistry.register({
  id: 'content-radar-pipeline',
  name: '内容采集分析管线',
  description: '采集 → 分析 → 生成选题',
  nodes: [...],
  edges: [...],
});

// 传入 mountRoutes
mountRoutes(app, { ..., templateRegistry });
```

#### 应用策略：追加合并（非覆盖）

选模板时调用 `applyTemplate()`，将模板内容**追加**到当前画布（而非覆盖），支持一个 graph 组合多个模板：

- **空画布**：直接填充
- **已有内容**：模板节点追加到画布空白区域（自动布局避开已有节点），用户手动连线接合两部分
- **Key 冲突**：自动加数字后缀（如 `planner` → `planner_2`），画布顶部显示 amber 提示条（5 秒自动消失，可手动关闭）列出所有重命名映射
- **START/END 处理**：追加时去掉模板的 `__start__` / `__end__` 连线，只保留中间节点和它们之间的边

#### 选择器 UI

模板选择统一在左侧面板 Blueprint Tab 的「选择模板」区域：

- **常驻列表**：紧凑卡片样式，显示模板名称、描述、节点/边数量
- **空画布引导**：画布无节点时，模板区顶部显示轻量引导提示（高亮背景 + "选择模板快速开始"文案），不遮挡画布
- **状态 badge**：已应用到当前画布的模板显示 teal「当前」badge；未实现的模板显示灰色「Phase 2」badge

不再使用全屏引导页或弹窗 Dialog。`TemplateGallery` 组件简化为 `TemplateList` 纯列表组件。

产品和开发选模板 → 增删改节点 → 连线 → 开发填实现。

## 套件结构（npm 包形态）

```
@linforge/core     # 核心逻辑：node registry、graph compiler、template registry、recorder、run manager、prompt loader、store 接口定义
@linforge/server   # 后端中间件：API 路由（基于 Store 接口，不绑定 ORM）
@linforge/react    # 前端组件：细粒度组件优先（GraphCanvas、TemplateList、NodePool、NodePropertyPanel、RunPanel、PromptEditor、StepDetailPanel、GraphStatusBar 等）
```

### 开发者代码 vs 套件代码

| 开发者写的（项目特有）           | 套件提供的（通用）                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 节点函数 (nodes/\*.ts)           | Node Registry — 注册 + 发现 + 自动匹配                                                                                        |
| State schema (Zod)               | Graph Compiler — DB def → LangGraph                                                                                           |
| 条件路由函数                     | StepRecorder — 自动注入                                                                                                       |
| Prompt 种子数据                  | RunManager — 触发/取消/abort                                                                                                  |
| **Store 适配器**（实现套件接口） | PromptLoader — cache + Mustache rendering + fallback                                                                          |
| 自定义模板（可选）               | Template Registry — 内置模板 + 自定义注册 + applyTemplate 追加合并                                                            |
|                                  | mountRoutes(app) — 一行挂载 API                                                                                               |
|                                  | **Store 接口定义**（GraphStore/StepPersister/PromptStore/RunStore）                                                           |
|                                  | 细粒度 React 组件（GraphCanvas/TemplateList/NodePool/NodePropertyPanel/RunPanel/PromptEditor/StepDetailPanel/GraphStatusBar） |
|                                  | 预置图模板（ReAct、Pipeline、Map-Reduce、Human-in-the-loop）                                                                  |

### 节点注册示例

```ts
// nodes/planner.ts
import { defineNode } from '@linforge/core';

export default defineNode({
  key: 'planner', // 匹配画布上的 skeleton 节点 key
  // 条件路由：key -> 函数，画布上的条件边选择这些 key
  routes: {
    has_tool_calls: (state) => state.messages.at(-1)?.tool_calls?.length > 0,
    text_response: (state) => !state.messages.at(-1)?.tool_calls?.length,
  },
  // 节点执行函数
  run: async (state) => {
    // ... 业务逻辑
  },
});
```

注意：`meta`（label、description、icon、hasPrompt）不在代码中定义——它们在画布上创建 skeleton 节点时已由产品/开发设置并存入 DB。`defineNode()` 只负责**代码绑定**。

### Graph Compiler 伪代码

```ts
// @linforge/core 内部
function compileGraph(
  stateSchema: any,
  dbDefinition: GraphDefinition,
  registry: NodeRegistry,
) {
  // 校验：所有节点是否都已绑定
  const unbound = dbDefinition.nodes.filter((n) => !registry.has(n.key));
  if (unbound.length > 0) {
    throw new Error(`Unbound nodes: ${unbound.map((n) => n.key).join(', ')}`);
  }

  const workflow = new StateGraph(stateSchema);

  for (const node of dbDefinition.nodes) {
    const impl = registry.get(node.key);
    workflow.addNode(node.key, impl.run);
  }

  // 按 source 分组，条件边通过 routeMap 编译
  const edgesBySource = groupBySource(dbDefinition.edges);
  for (const [source, edges] of edgesBySource) {
    const conditionalEdge = edges.find((e) => e.routeMap);
    if (conditionalEdge && conditionalEdge.routeMap) {
      const impl = registry.get(source);
      const routeMap = conditionalEdge.routeMap;
      const routeFn = (state) => {
        for (const key of Object.keys(routeMap)) {
          if (impl.routes[key]?.(state)) return key;
        }
        return Object.keys(routeMap)[0]; // 兜底
      };
      workflow.addConditionalEdges(source, routeFn, routeMap);
    } else {
      for (const edge of edges) {
        workflow.addEdge(edge.source, edge.target);
      }
    }
  }

  return workflow.compile();
}
```

## UI：统一工作台（Monitor + Studio 合并）

当前 ContentRadar 的 /agent（Monitor）和 /agent/studio（Studio）应合并为一个工作台。

### 布局

```
+--[Header]----------------------------------[StatusBar]--+
|  Agent Studio                    5/7 bound | Graph OK   |
+--[Left 280px]--+--[Canvas flex-1]--+--[Right 420px]-----+
| [Blueprint][Run]|                   |                    |
|-----------------|                   | NodePropertyPanel  |
| Templates       |  Blueprint/Replay |  - name, desc      |
|  ReAct [active] |                   |  - icon picker     |
|  Pipeline       |  Click node ->    |  - color picker    |
|  ...            |  right panel      |  - PromptEditor    |
|-----------------|                   |                    |
| Node Pool       |                   | -- or in Replay -- |
|  planner    [*] |                   |                    |
|  tools      [*] |                   | StepDetailPanel    |
|  analyzer   [*] |                   |  - output          |
+-----------------+-------------------+  - state snapshot  |
                                      +--------------------+
```

> **说明**：左侧面板有两个 Tab（Blueprint / 运行调试），Blueprint Tab 显示模板列表和节点池，
> 运行调试 Tab 显示 RunPanel（指令输入 + 运行历史）。右侧面板根据上下文显示节点属性编辑或步骤详情。
> 顶部状态栏显示绑定进度和图验证状态。三个面板均可收起，全部收起后画布占满可用空间。

### 画布模式

`GraphCanvas` 通过 `mode` prop 切换两种模式：

| 模式                  | 触发              | 行为                                                         |
| --------------------- | ----------------- | ------------------------------------------------------------ |
| **Blueprint（编辑）** | 默认 / 无选中 run | 拖入节点、连线、配 Prompt、调参数。Skeleton 节点灰色虚线显示 |
| **Replay（回放）**    | 选中某次 run      | 节点逐个亮起、点击看 step output + state                     |

**模式切换规则**：宿主通过 `selectedRunId` 控制 — 非空时 `mode='replay'`，空时 `mode='blueprint'`。
用户点击同一 run 卡片 toggle 选中/取消，无需额外切换按钮。切到 Blueprint Tab 时自动退出回放（`selectRun(null)`）；选中运行记录时自动切到运行调试 Tab。

**Replay 模式限制**：禁用所有编辑操作（拖拽、连线、右键菜单、删除、边配置弹窗），隐藏模板按钮和引导页。

**退出回放**：Replay 模式下画布右上角显示"退出回放"按钮（X 图标），点击调用 `selectRun(null)` 回到 Blueprint 模式。该按钮由宿主渲染（绝对定位覆盖在画布上），确保即使 RunPanel 被收起也能退出回放状态。

#### 节点 Replay 状态

`GraphCanvas` 接收 `replaySteps: ReplayStep[]`，注入到节点 `data` 中。

```ts
interface ReplayStep {
  nodeKey: string;
  status: 'completed' | 'running' | 'failed';
  durationMs?: number;
  tokensUsed?: number;
}
```

| Status    | Border    | Background | Effect                              |
| --------- | --------- | ---------- | ----------------------------------- |
| idle      | `#e5e7eb` | `#fff`     | opacity 0.5                         |
| completed | `#10b981` | `#ecfdf5`  | green glow, bottom: duration+tokens |
| running   | `#3b82f6` | `#eff6ff`  | blue pulse animation (2s loop)      |
| failed    | `#ef4444` | `#fef2f2`  | red glow, bottom: duration+tokens   |

> Terminal 节点（\_\_start\_\_/\_\_end\_\_）也支持 replayStatus，但不显示底部统计。
> \_\_start\_\_ 在有步骤时自动标记 completed；\_\_end\_\_ 在所有步骤 completed 时标记 completed。

#### 边 Replay 状态

已执行路径（source 和 target 均有 step 记录）的边 `animated: true`，未执行边 `opacity: 0.3`。

### 左侧面板（Tab 切换）

左侧面板（280px），通过 Tab 切换两种内容。Linforge 导出细粒度子组件（`TemplateList`、`NodePool`、`RunPanel`），宿主负责 Tab 切换和布局组装。

```
+---[Left Panel 280px]---+
| [Blueprint] [Run/Debug] |  <- Tab bar
|--------------------------|
| Blueprint Tab:           |
|   "Choose a template"   |  <- guide hint (empty canvas only)
|   [TemplateCard] active  |
|   [TemplateCard]         |
|   ---                    |
|   Node Pool              |
|   planner         [*]   |
|   tools           [*]   |
|   analyzer        [*]   |
|--------------------------|
| Run/Debug Tab:           |
|   [textarea 3 rows]     |
|   [teal gradient button] |
|   ---                    |
|   Run History            |
|   [RunCard] selected     |
|   [RunCard]              |
+---------------------------+
```

> **说明**：Blueprint Tab 包含 `TemplateList`（模板选择）+ `NodePool`（已注册节点列表）。
> 运行调试 Tab 包含现有 `RunPanel`（指令输入 + 运行历史）。
> Tab 切换由宿主管理，Linforge 不内置 Tab 组件。

#### TemplateList 组件

替代原 `TemplateGallery`，简化为纯列表：

- 紧凑卡片：图标 + 名称 + 描述 + 节点/边数量 badge
- 「当前」badge（teal）：已应用到画布的模板
- 「Phase 2」badge（灰色）：暂不可用的模板（通过 `disabled` prop 控制）
- 空画布引导：`isCanvasEmpty` 为 true 时顶部显示高亮提示
- 点击卡片触发 `onSelect(templateId)` 回调
- 纯内联样式

#### NodePool 组件

左侧面板常驻的节点池列表，与右键菜单节点池并存（双入口）：

- 每项：label + key（灰色，截断 `max-width: 45%`）+ 绑定圆点（绿色 = bound，灰色 = skeleton/未添加）
- 已在画布上的节点：半透明（`opacity: 0.55`），可点击查看详情（`onNodeClick` → 触发画布节点选中逻辑，如打开 PromptEditor）
- 未在画布上的节点：正常样式，点击触发 `onAddNode(nodeKey, label)` 回调（节点创建在画布中心）
- 数据源：`registryNodes`（与 `GraphCanvas` 的右键菜单共享）
- 纯内联样式，无横向滚动（key 文本 `text-overflow: ellipsis`）

#### RunPanel 组件

运行调试 Tab 内容，提供运行输入和历史列表。纯内联样式。

> RunPanel 通过 `useLinforgeRuns` hook 管理状态，宿主仅需传入 `apiBase` + `slug`，
> 通过 `onRunSelect` / `onStepsChange` 回调同步 selectedRunId 和 replaySteps 给画布。

#### 面板折叠

左侧面板整体可折叠以最大化画布空间：

- 折叠状态由宿主管理，宿主控制是否渲染左侧面板
- 收起后画布左上角渲染单个悬浮按钮（sidebar 图标），点击展开面板并恢复折叠前的 Tab 状态
- 悬浮按钮样式：白底、圆角 10px、1px 边框、轻阴影

**RunCard 三行信息**：

- 行 1：instruction（truncate）+ running 脉冲圆点
- 行 2：状态 badge（运行中/完成/失败/已取消）+ 相对时间
- 行 3（条件）：token pill + duration

**轮询策略**（参考 ContentRadar Agent Monitor）：

- 列表：有 running 时 10s 轮询
- 步骤：选中 run 为 running 时 3s 轮询
- AbortController 防竞态，组件卸载自动清理

### 核心工作流

```
1. Left panel Blueprint Tab: pick template or start blank
2. Add nodes from NodePool (left panel or right-click), name them, write descriptions
3. Wire edges on canvas (conditional edges marked as "pending")
4. Dev writes defineNode() to bind implementations, Studio auto-matches (NodePool dots turn green)
5. Click node -> right panel NodePropertyPanel: edit Prompt + temperature
6. Check top StatusBar: "7/7 bound, Graph OK" -> ready to run
7. Switch to Run/Debug Tab, enter instruction, click Run
8. Canvas auto-switches to Replay mode, executed nodes glow green, running nodes pulse blue
9. Click glowing node -> right panel shows StepDetailPanel (output + state)
10. Click same run card to deselect -> back to Blueprint mode
11. Edit Prompt, run again -> compare results
```

> **说明**：步骤 1-5 在 Blueprint Tab 完成（画图+配置），步骤 6 检查状态栏确认就绪，
> 步骤 7-11 在运行调试 Tab 完成（运行+调试迭代循环）。

### NodePropertyPanel 组件

右侧面板（420px），点击任意节点时显示。Linforge 导出完整组件，宿主只需传 props。纯内联样式。

```
+--[NodePropertyPanel 420px]--+
| [icon] planner               |
| ReAct Planner                |
|------------------------------|
| Node Name    [input]         |
| Description  [textarea]      |
| Icon         [8-12 grid]     |
| Color        [7 circles]     |
|------------------------------|
| PROMPT (hasPrompt only)      |
| [version dropdown]           |
| [monospace textarea]         |
| Placeholders | Temperature   |
| [Save new version] [Activate]|
+------------------------------+
```

> **说明**：点击任意节点（不限 hasPrompt）均可打开。hasPrompt 节点底部集成 PromptEditor。

#### 属性编辑

- **名称**：单行输入框，修改后 debounce 自动保存
- **描述**：多行文本框，修改后 debounce 自动保存
- **图标**：grid 选择器，8~12 个内置图标（inline SVG，不依赖宿主图标库），点击即保存。后续可通过 `extraIcons` prop 扩展
- **颜色**：7 个预设色圈（teal/blue/amber/purple/pink/green/gray），点击即保存
- 无读/编辑模式切换，所有字段始终可编辑

#### 内置图标集

Linforge 内置覆盖 Agent 常用场景的图标（inline SVG 渲染）：

| 图标      | 含义      | 适用节点类型 |
| --------- | --------- | ------------ |
| edit      | 编辑/规划 | planner      |
| eye       | 观察/分析 | analyzer     |
| zap       | 闪电/执行 | tools        |
| lightbulb | 灯泡/生成 | generator    |
| link      | 链接/关联 | connector    |
| smile     | 表情/交互 | human review |
| square    | 方块/通用 | generic      |
| copy      | 复制/保存 | save/output  |

#### 内置颜色预设

| 颜色   | 色值      | 适用场景  |
| ------ | --------- | --------- |
| teal   | `#0d9488` | 默认/主要 |
| blue   | `#2563eb` | 工具/执行 |
| amber  | `#d97706` | 条件/检查 |
| purple | `#7c3aed` | 分析/AI   |
| pink   | `#db2777` | 人工/审核 |
| green  | `#059669` | 保存/完成 |
| gray   | `#6b7280` | 通用/辅助 |

#### Prompt 占位符文档

`promptPlaceholders?: Record<string, string[]>` 可选 prop，key 为 nodeKey，value 为占位符名称列表。传入后在 Prompt textarea 下方以 teal code badge 渲染（如 `{status}`、`{instruction}`），与 Temperature 输入框并排显示。未传入时显示"无"。

宿主负责定义各节点的占位符（业务相关），Linforge 只负责渲染。

#### 节点卡片颜色应用

`LinforgeNode` 读取 `icon` 和 `color` 字段并应用到画布节点卡片：

- **图标**：标题行左侧渲染 inline SVG（14px，使用节点颜色）
- **颜色**：左侧 accent line、Handle 圆点、选中边框和外发光均使用节点颜色（从 `BUILTIN_COLORS` 查值，fallback `#0d9488`）

#### 保存机制

属性修改通过 `onNodeChange(nodeKey, changes)` 回调通知宿主。`changes` 类型为 `Partial<Pick<GraphNodeDef, 'label' | 'description' | 'icon' | 'color'>>`。宿主更新本地 `graphDef` 中对应节点字段，触发现有 `saveGraph(graphDef)` debounce 整图 PUT。不新增单节点 API。

`saveGraph` 支持乐观更新：调用时立即更新本地 `graphDef` 状态（画布即刻反映），500ms 后再发 PUT 同步服务端。

Prompt 编辑保留现有手动保存机制（"保存为新版本" + "激活此版本"按钮）。

#### 右侧面板上下文切换

| 模式      | 点击节点         | 显示内容                                           |
| --------- | ---------------- | -------------------------------------------------- |
| Blueprint | 任意节点         | NodePropertyPanel（hasPrompt 节点含 PromptEditor） |
| Replay    | 有步骤记录的节点 | StepDetailPanel（output + state snapshot）         |
| —         | 点击画布空白     | 关闭右侧面板                                       |

### GraphStatusBar 组件

顶部状态栏，显示绑定进度和图验证状态。Linforge 导出组件，宿主放入 header 区域。

#### 显示内容

- **绑定进度**：`X/Y 节点已绑定`（X = bound 节点数，Y = 总非 start/end 节点数）
- **图验证 badge**：`Graph 有效`（绿色）或 `Graph 无效`（红色/灰色）

#### 验证规则

图在以下条件均满足时为「有效」：

1. 所有非 start/end 节点已绑定（无 skeleton）
2. 所有条件边的 source 节点有注册的 routes（无 pending 条件边）

不做连通性检查（孤立节点不影响编译，后续可扩展）。

#### Props

```ts
interface GraphStatusBarProps {
  skeletonKeys: string[];
  registryNodes: RegistryNode[];
  graphDef: GraphDefinition | null;
}
```

## 设计参考来源

> Linforge 从 ContentRadar 项目孵化，以下模块的设计经验为 Linforge 提供了参考。
> Linforge 独立实现，不复用 ContentRadar 代码。

| 参考模块                           | 参考价值 | Linforge 的独立实现方式                                                                                     |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| GraphPanel + AgentNode + SmartEdge | 交互模式 | 独立实现，新增 skeleton 节点渲染 + registry 驱动                                                            |
| StepRecorder (withStepRecording)   | 接口抽象 | 已完成：`StepPersister` 接口 + Compiler 自动注入（`summarizeOutput` 从 `NodeDefinition` 读取）              |
| PromptEditor + 版本管理            | 功能设计 | 已完成：`PromptStore` 完整接口 + `PromptEditor` 组件 + `useLinforgePrompt` hook                             |
| Run 管理 (触发/取消/历史/轮询)     | 功能设计 | 已完成：`RunManager` + `RunStore` 接口                                                                      |
| Graph Compiler                     | 核心创新 | 已完成：DB 图定义 + NodeRegistry → LangGraph 编译                                                           |
| Node Registry                      | 核心创新 | 已完成：注册 + 自动匹配 + bound/skeleton 状态                                                               |
| Template Library                   | 已完成   | `TemplateRegistry` + `applyTemplate()` + 4 个内置模板 + `TemplateList` 组件（`TemplateGallery` deprecated） |

## Run 数据模型与 Store 接口

### RunRecord — 通用 Run 模型

Linforge 定义执行层面的通用 Run 概念，不包含业务字段（如 userId、costUsd）。宿主特有字段由适配器内部处理。

```ts
interface RunRecord {
  id: string;
  graphSlug: string; // 关联哪个图
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  input?: Record<string, unknown>; // 运行输入（通用 JSON，宿主决定内容）
  result?: Record<string, unknown>; // 运行结果（通用 JSON）
  tokensUsed: number;
  startedAt: Date;
  finishedAt?: Date;
}
```

### Store 接口（完整）

```ts
interface RunStore {
  createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(
    graphSlug: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<RunRecord[]>;
  updateRunStatus(
    runId: string,
    status: RunRecord['status'],
    data?: Record<string, unknown>,
  ): Promise<void>;
}

interface StepPersister {
  createStep(data: StepData): Promise<void>;
  getSteps(runId: string): Promise<StepData[]>;
}
```

### Server 路由

| Method | Path                                             | Description          |
| ------ | ------------------------------------------------ | -------------------- |
| GET    | `{prefix}/graphs`                                | 图列表（精简版）     |
| GET    | `{prefix}/graph/:slug/runs`                      | 运行历史列表（分页） |
| GET    | `{prefix}/runs/:runId`                           | 运行详情             |
| GET    | `{prefix}/runs/:runId/steps`                     | 步骤列表             |
| GET    | `{prefix}/prompts/:nodeId`                       | Prompt 版本列表      |
| GET    | `{prefix}/prompts/:nodeId/active`                | 活跃 Prompt 版本     |
| POST   | `{prefix}/prompts/:nodeId`                       | 创建 Prompt 新版本   |
| POST   | `{prefix}/prompts/:nodeId/versions/:id/activate` | 激活指定版本         |

### 宿主适配器示例（ContentRadar + Prisma）

```
RunRecord.id            <-> AgentRun.id
RunRecord.graphSlug     <-> AgentRun.graphSlug（新增字段）
RunRecord.status        <-> AgentRun.status（枚举映射）
RunRecord.input         <-> { instruction: AgentRun.instruction }
RunRecord.result        <-> AgentRun.stateSnapshot
RunRecord.tokensUsed    <-> AgentRun.tokensUsed
RunRecord.startedAt     <-> AgentRun.startedAt
RunRecord.finishedAt    <-> AgentRun.finishedAt
                            AgentRun.userId — 适配器内部处理，不暴露给 Linforge
                            AgentRun.costUsd — 同上
```

> **说明**：适配器代码放宿主项目（如 `packages/server/src/linforge/`），不放 Linforge 包内

## 设计决策

> 以下问题已在 2026-02-22 讨论中确定

### 1. DB 归属 → 接口式

套件定义 Store 接口（`GraphStore`、`StepPersister`、`PromptStore`、`RunStore`），宿主项目自行实现适配器（Prisma/Drizzle/Mongo 等）。Linforge 零 DB 依赖，不提供 schema 也不管理连接。

### 2. 前端组件粒度 → 先细粒度，后组装

先实现独立组件：`<GraphCanvas />`、`<RunHistory />`、`<StepTimeline />`、`<PromptEditor />`、`<NodeSidePanel />` 等。后续组装为 `<AgentWorkbench />` 整页组件。

### 3. State 快照策略 → 默认 summary，debug 模式完整记录

通过配置项控制（如 `{ debug: true }`），默认只记录 output summary 以控制存储量，debug 模式记录完整 state snapshot。

### 4. 运行对比 → 先结果对比 + 节点 output diff

优先实现两次 run 的最终结果对比和节点级 output diff。State diff 作为后续扩展。

### 5. 节点池 UI → 增强右键菜单

右键画布弹出节点选择器，直接列出已注册节点。不加顶部工具栏按钮（添加节点是高频操作，右键更自然）。

### 6. Skeleton 节点 key 分配 → 手动输入（自定义节点）

两条创建路径：

- **已注册节点**：点击右键菜单中的节点项 → 直接创建，key/label 来自 registry，无弹窗
- **自定义 skeleton**：点击"自定义节点" → 弹窗手动输入 key + label（现有 `CreateNodeDialog`）
- **重复处理**：已在画布上的 key 置灰禁止重复添加（同 key 编译会冲突）

### 7. 图拓扑来源 → 完全从 DB 来

图结构在画布上创建和编辑，存储到 DB（通过 `GraphStore` 接口）。不需要从代码图自动生成 DB 种子数据。

### 8. Blueprint ↔ Replay 切换 → selectedRunId 驱动

无选中 run → Blueprint，选中 run → Replay。点击同一 run 卡片 toggle。无需额外切换按钮，模式由数据状态自然决定。

### 9. 运行历史搜索 → 前端过滤（不扩展 Store 接口）

列表 limit=50 数据量小，前端本地 filter 即可。不在 `RunStore.listRuns` 接口加 `search` 参数，避免每个适配器都要实现搜索逻辑，且 `RunRecord.input` 是通用 JSON 无法约定搜索字段。宿主如需后端搜索可自行扩展路由。

### 10. GraphNodeDef 扩展字段 → metadata 透传

宿主 DB 可能有 Linforge 不认识的业务字段（如 `configSummary`、`handlerKey`、`config`）。`GraphNodeDef` 新增 `metadata?: Record<string, unknown>`，Linforge 不解读但透传存储。适配器在读写时将宿主特有字段塞入/取出 `metadata`，避免污染通用类型。

### 11. nodeType → 放宽为 string

`GraphNodeDef.nodeType` 从 `'node' | 'start' | 'end'` 放宽为 `string`。Linforge 只特殊处理 `'start'` / `'end'`（渲染终端节点），其余值一律按普通节点渲染。宿主可传入任意业务类型（如 `'llm'`、`'tool'`、`'condition'`），Linforge 透传不干预。

理由：Linforge 不内置节点类型驱动的特殊 UI（与 Dify/n8n 不同，Linforge 的节点行为由代码 `defineNode()` 决定，不由类型决定）。未来如需类型驱动的特殊渲染，再收紧为受控枚举。

### 12. 条件边存储 → routeMap 替代 conditionKey/conditionValue

Prisma `AgentGraphEdge` 新增 `routeMap Json?` 字段，废弃 `conditionKey` + `conditionValue`（ContentRadar 早期设计，Linforge 已用 `routeMap` 替代）。适配器直接映射 `GraphEdgeDef.routeMap ↔ AgentGraphEdge.routeMap`，无需转换。

### 13. PromptStore 适配 → 独立薄适配器

`PromptStore` 接口提供完整的 Prompt 版本管理能力：

```ts
interface PromptStore {
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  listVersions(nodeId: string): Promise<PromptVersion[]>;
  createVersion(
    nodeId: string,
    data: CreatePromptVersionInput,
  ): Promise<PromptVersion>;
  activateVersion(nodeId: string, versionId: string): Promise<void>;
}
```

- `PromptVersion` extends `PromptTemplate`，增加 `nodeId`、`version`、`isActive`、`createdAt`
- 每次保存创建新的不可变版本（版本号自增），激活时同 nodeId 互斥
- 宿主实现 `PrismaPromptStore` 适配器，映射到宿主的 `PromptTemplate` 表
- `PromptStore` 供 Linforge 路由和组件使用；宿主的 `promptLoader`（带缓存）供 Agent 执行时使用，两者各管各的入口，不互相依赖

### 14. 两套运行流程 → 已收敛（Phase 2.5）

Phase 2.5 验证通过后，Linforge 运行入口（`POST /api/linforge/graph/:slug/run` → `RunManager` → `GraphCompiler`）成为唯一的 Agent 执行路径。原有入口 `POST /api/agent/run`（→ `runner.ts` → 硬编码 `graph.ts`）已标记 `@deprecated`，只读 API（`GET /api/agent/runs`、`GET /api/agent/runs/:id`、`POST /api/agent/runs/:id/cancel`）保留供前端旧页面使用，后续前端迁移完成后可移除。

### 15. 左侧面板 Tab 组件归属 → 细粒度子组件（宿主组装）

Linforge 导出 `TemplateList`、`NodePool` 子组件，Tab 切换逻辑由宿主 `LinforgeStudio.tsx` 组装。符合设计决策 2（先细粒度后组装）。宿主可自由定制 Tab 样式和排列。

### 16. 模板展示方式 → 引导降级（左侧面板常驻列表）

去掉全屏引导页（`TemplateGallery mode='page'`）和弹窗（`mode='dialog'`），统一用左侧面板 `TemplateList` 组件。空画布时模板区顶部加轻量引导提示，不遮挡画布。`TemplateGallery` 组件废弃，简化为 `TemplateList`。

### 17. 节点池入口 → 双入口并存

左侧面板 `NodePool` 组件（常驻，查看绑定状态）+ 右键菜单节点列表（带位置快速添加）并存。两者共享 `registryNodes` 数据源。左侧面板点击创建节点在画布中心，右键菜单点击创建在右键位置。

### 18. 右侧 NodePropertyPanel → Linforge 出完整组件

`NodePropertyPanel` 内置属性编辑（名称/描述/图标/颜色）+ PromptEditor 集成，宿主只需传 props。属性面板结构对所有宿主一致，无定制需求。名称/描述/图标/颜色实时 debounce 保存（通过 `onNodeChange` 回调 + 复用现有 `saveGraph` 整图 PUT），Prompt 保留手动"保存为新版本"。内置 8 图标 + 7 颜色预设，不依赖宿主图标库。

## 节点池（Node Pool）

节点池是 NodeRegistry 在前端的可视化投影，让画布用户能看到代码层注册的节点并快速添加到画布。

### 入口（双入口并存）

**入口 1：左侧面板 `NodePool` 组件**（常驻，查看绑定状态 + 添加/查看详情）

- 已注册节点列表，每项：label + key（灰色截断）+ 绑定圆点（绿色 = bound，灰色 = skeleton/未添加）
- 已在画布上的节点：半透明，可点击查看详情（触发 `onNodeClick` → 画布节点选中 → 右侧面板）
- 未在画布上的节点：点击 `onAddNode(nodeKey, label)` → 节点创建在画布中心

**入口 2：右键菜单 `ContextMenu`**（带位置快速添加）

增强右键菜单，展示两部分：

1. **已注册节点列表** — 从 `registryNodes`（`GET /registry/nodes`）获取，每项显示 label + key
   - 已在画布上的节点：置灰 + 禁止点击（同 key 不可重复，编译会冲突）
   - 未在画布上的节点：点击直接创建，key/label 来自 registry，position 使用右键坐标，无弹窗
2. **"自定义节点"入口** — 底部分隔线后，点击打开现有 `CreateNodeDialog` 弹窗（手动输入 key + label，创建 skeleton 节点）

### 数据流

```
GET /registry/nodes
  -> useLinforgeGraph.registryNodes (already loaded)
  -> GraphCanvas passes to ContextMenu
  -> ContextMenu renders list, compares with existingKeys for disable state
  -> Click registered node -> onAddRegisteredNode(nodeKey, label, position)
  -> Click custom node    -> onAddNode() -> CreateNodeDialog (existing flow)
```

### 创建行为

| 场景             | key 来源 | label 来源 | 弹窗             | 结果          |
| ---------------- | -------- | ---------- | ---------------- | ------------- |
| 点击已注册节点   | registry | registry   | 无               | bound 节点    |
| 点击"自定义节点" | 手动输入 | 手动输入   | CreateNodeDialog | skeleton 节点 |

## 条件边配置

### 数据流

条件边的 `routeMap`（`Record<string, string>`，route key → target node key）贯穿完整的数据链路：

```
DB (GraphEdgeDef.routeMap)
  → buildLayout() → edge.data.routeMap (React Flow)
  → toGraphDef()  → GraphEdgeDef.routeMap (保存回 DB)
```

`buildLayout()` 接收 `routeKeysMap`（从 Registry API 获取），用于区分条件边的 pending/active 状态。

### 视觉区分

| 边类型         | 样式                                         | 触发条件                              |
| -------------- | -------------------------------------------- | ------------------------------------- |
| 普通边         | 实线，brand 色 `#2dd4bf`                     | 无 `routeMap`                         |
| 条件边 active  | 虚线 `strokeDasharray: 6 3`，amber `#f59e0b` | 有 `routeMap` 且 source 节点有 routes |
| 条件边 pending | 虚线 `strokeDasharray: 6 3`，灰色 `#9ca3af`  | 有 `routeMap` 但 source 节点无 routes |

### EdgeConfigPopover

点击边弹出配置弹出框（纯内联样式，不依赖宿主 Tailwind）：

- **标签输入框**：编辑边的 `label`
- **条件边 Toggle**：开启/关闭条件边
- **Route Keys 映射**：Toggle 开启后显示 source 节点的已注册 route keys，每个 key 显示当前 target
- **自动填充**：Toggle 从 OFF→ON 时，自动为每个 route key 填入当前 `edge.target` 作为默认映射

### Registry API

`GET /registry/nodes` 响应每个节点包含 `routeKeys: string[]`，从 `NodeDefinition.routes` 的 `Object.keys()` 提取。`useLinforgeGraph` 加载图定义时并行请求该接口，结果通过 `registryNodes` 传给 `GraphCanvas`。
