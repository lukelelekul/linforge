import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';

// ============================================================
// Node definitions (created by developers via defineNode)
// ============================================================

/**
 * Custom output summarizer function.
 * Receives node input and output, returns a structured summary object.
 */
export type OutputSummarizer<S = any> = (
  input: S,
  output: Partial<S>,
) => Record<string, unknown>;

/**
 * Node definition — created by defineNode().
 * S = state type inferred from StateSchema.
 */
export interface NodeDefinition<S = any> {
  /** Unique identifier, maps to DB GraphNode.key */
  key: string;
  /** Display label (optional, used in node pool UI; falls back to key if omitted) */
  label?: string;
  /** Conditional routes: each key maps to a predicate function */
  routes?: Record<string, (state: S) => boolean>;
  /** Node execution logic */
  run: (state: S) => Promise<Partial<S>>;
  /** Custom output summarizer (used by StepRecorder) */
  summarizeOutput?: OutputSummarizer<S>;
}

/**
 * Options for defineNode (same shape as NodeDefinition, key is required).
 */
export interface DefineNodeOptions<S = any> {
  key: string;
  label?: string;
  routes?: Record<string, (state: S) => boolean>;
  run: (state: S) => Promise<Partial<S>>;
  summarizeOutput?: OutputSummarizer<S>;
}

// ============================================================
// DB graph definition (produced by canvas editing)
// ============================================================

export interface GraphNodeDef {
  /** Node key, maps to NodeDefinition.key */
  key: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Lucide icon name */
  icon?: string;
  /** Whether the node has an editable Prompt */
  hasPrompt?: boolean;
  /** Canvas position */
  position?: { x: number; y: number };
  /** Node color class name */
  color?: string;
  /** Node type, defaults to 'node' (host can extend, e.g. 'llm' / 'tool') */
  nodeType?: string;
  /** Host extension fields (passed through for storage, not interpreted by Linforge) */
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeDef {
  /** Source node key */
  source: string;
  /** Target node key */
  target: string;
  /**
   * Conditional route mapping: route key -> target node key.
   * Used for addConditionalEdges routeMap.
   * Edges sharing the same source share one routeMap (grouped by source during compilation).
   */
  routeMap?: Record<string, string>;
  /** Edge label (for visualization) */
  label?: string;
  /** React Flow source handle ID */
  sourceHandle?: string;
  /** React Flow target handle ID */
  targetHandle?: string;
}

export interface GraphDefinition {
  id: string;
  slug: string;
  name: string;
  /** Icon identifier (built-in icon ID or custom value) */
  icon?: string;
  nodes: GraphNodeDef[];
  edges: GraphEdgeDef[];
}

// ============================================================
// Graph templates (preset topology, no position)
// ============================================================

/** Template node — pure logical description, position is computed by auto-layout */
export interface TemplateNode {
  /** Skeleton node key */
  key: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Lucide icon name (optional, applied to GraphNodeDef.icon) */
  icon?: string;
  /** Node color class name (optional, applied to GraphNodeDef.color) */
  color?: string;
}

/** Template edge — pure topological relationship */
export interface TemplateEdge {
  /** Source node key */
  source: string;
  /** Target node key */
  target: string;
  /** Conditional route mapping (route key -> target node key) */
  routeMap?: Record<string, string>;
  /** Edge label */
  label?: string;
}

/** Graph template — predefined Agent pattern topology */
export interface GraphTemplate {
  /** Unique identifier, e.g. 'react-agent' */
  id: string;
  /** Display name */
  name: string;
  /** One-line scenario description */
  description: string;
  /** Category tag */
  category?: string;
  /** Template nodes (all skeleton) */
  nodes: TemplateNode[];
  /** Template edges */
  edges: TemplateEdge[];
  /** Mark as unavailable (display only, cannot be applied) */
  disabled?: boolean;
}

// ============================================================
// DB adapter interfaces (decoupled from Prisma)
// ============================================================

export interface StepData {
  agentRunId: string;
  nodeId: string;
  stepNumber: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  tokensUsed: number;
  toolName?: string;
  /** Debug mode: state snapshot before node execution */
  stateBefore?: Record<string, unknown>;
  /** Debug mode: state snapshot after node execution */
  stateAfter?: Record<string, unknown>;
}

export interface StepPersister {
  /** Write a single step record */
  createStep(data: StepData): Promise<void>;
  /** Query all steps for a given run */
  getSteps(runId: string): Promise<StepData[]>;
}

export interface PromptTemplate {
  id: string;
  template: string;
  temperature: number;
}

/** Prompt version — superset of PromptTemplate, includes version management fields */
export interface PromptVersion extends PromptTemplate {
  /** Associated node ID (e.g. "planner" / "analyzer") */
  nodeId: string;
  /** Version number (auto-increments within the same nodeId) */
  version: number;
  /** Whether this is the currently active version */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: Date;
}

/** Input data when creating a new version */
export interface CreatePromptVersionInput {
  /** Prompt template content */
  template: string;
  /** LLM temperature (default 0.3) */
  temperature?: number;
}

export interface PromptStore {
  /** Get the currently active Prompt template for a given node */
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  /** List all versions for a given node (ordered by version desc) */
  listVersions(nodeId: string): Promise<PromptVersion[]>;
  /** Create a new version for a given node (version number auto-increments, inactive by default) */
  createVersion(
    nodeId: string,
    data: CreatePromptVersionInput,
  ): Promise<PromptVersion>;
  /** Activate a specific version (mutually exclusive within the same nodeId, other versions are deactivated) */
  activateVersion(nodeId: string, versionId: string): Promise<void>;
}

// ============================================================
// Run data model
// ============================================================

/** Generic Run record — excludes business fields (userId, costUsd, etc. are handled by host adapters) */
export interface RunRecord {
  id: string;
  /** Associated graph slug */
  graphSlug: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  /** Run input (generic JSON, content decided by host) */
  input?: Record<string, unknown>;
  /** Run result (generic JSON) */
  result?: Record<string, unknown>;
  /** 业务上下文透传（userId, tenantId, source 等） */
  metadata?: Record<string, unknown>;
  tokensUsed: number;
  startedAt: Date;
  finishedAt?: Date;
}

export interface RunStore {
  /** Create a run record */
  createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void>;
  /** Get a single run record */
  getRun(runId: string): Promise<RunRecord | null>;
  /** List run history for a graph (paginated) */
  listRuns(
    graphSlug: string,
    opts?: { limit?: number; offset?: number; metadata?: Record<string, unknown> },
  ): Promise<RunRecord[]>;
  /** Update run status */
  updateRunStatus(
    runId: string,
    status: RunRecord['status'],
    data?: Record<string, unknown>,
  ): Promise<void>;
}

export interface GraphStore {
  /** Get graph definition by slug */
  getGraph(slug: string): Promise<GraphDefinition | null>;
  /** Save graph definition (create or overwrite) */
  saveGraph(graph: GraphDefinition): Promise<void>;
  /** List all graph definitions */
  listGraphs(): Promise<GraphDefinition[]>;
}

// ============================================================
// GraphCompiler related
// ============================================================

export interface CompileOptions<S = any> {
  /** LangGraph StateSchema instance */
  stateSchema: any;
  /** Graph definition (loaded from DB or static config) */
  graphDef: GraphDefinition;
  /** Checkpoint persistence (optional) */
  checkpointer?: any;
  /**
   * Step recording configuration (optional).
   * When enabled, the compiler automatically wraps all nodes with withStepRecording.
   * Each node's summarizeOutput is automatically read from its NodeDefinition.
   */
  stepRecording?: {
    persister: StepPersister;
    /** Key to extract runId from state, defaults to "agentRunId" */
    runIdKey?: string;
    /** Custom input summarizer function */
    inputSummarizer?: (
      state: Record<string, unknown>,
    ) => Record<string, unknown>;
    /** Enable debug: record full state snapshots */
    debug?: boolean;
  };
}

export interface CompiledGraph {
  /** Compiled LangGraph Runnable */
  graph: Runnable;
  /** Node binding status */
  bindingStatus: {
    bound: string[];
    skeleton: string[];
  };
}

// ============================================================
// RunManager related
// ============================================================

export interface RunCallbacks {
  onCompleted?: (runId: string, result: unknown) => void | Promise<void>;
  onFailed?: (runId: string, error: Error) => void | Promise<void>;
}

export interface RunOptions {
  runId: string;
  /** Associated graph slug (used for createRun) */
  graphSlug: string;
  input: Record<string, unknown>;
  /** Input stored to RunStore (may include extra fields like instruction); falls back to input if omitted */
  storeInput?: Record<string, unknown>;
  store?: RunStore;
  callbacks?: RunCallbacks;
  /** 业务上下文透传，写入 RunRecord.metadata */
  metadata?: Record<string, unknown>;
  /** Timeout in milliseconds, defaults to 300000 (5 min) */
  timeoutMs?: number;
}
