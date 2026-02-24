import { StateGraph, START, END } from '@langchain/langgraph';
import type { NodeRegistry } from './NodeRegistry';
import type { CompileOptions, CompiledGraph, GraphEdgeDef } from './types';
import { withStepRecording } from './StepRecorder';

/**
 * Graph compiler.
 * Compiles a DB graph definition + NodeRegistry into a LangGraph StateGraph.
 */
export class GraphCompiler {
  constructor(private registry: NodeRegistry) {}

  /**
   * Compile the graph.
   * 1. Validate all nodes are bound (throw if any skeleton nodes remain)
   * 2. Iterate nodes -> addNode
   * 3. Iterate edges -> addEdge / addConditionalEdges
   * 4. Return the compiled Runnable
   */
  compile(options: CompileOptions): CompiledGraph {
    const { stateSchema, graphDef, checkpointer, stepRecording } = options;

    // Validate stateSchema
    if (!stateSchema) {
      throw new Error(
        'GraphCompiler: stateSchema 为必填项。请传入 LangGraph StateSchema 实例。',
      );
    }

    // Validate binding status
    const bindingStatus = this.registry.getBindingStatus(graphDef);
    if (bindingStatus.skeleton.length > 0) {
      throw new Error(
        `GraphCompiler: 以下节点未绑定实现: ${bindingStatus.skeleton.join(', ')}。` +
          '请先用 defineNode() 定义并注册到 NodeRegistry。',
      );
    }

    // Build StateGraph
    const workflow = new StateGraph(stateSchema);

    // Register nodes (skip __start__ and __end__)
    for (const nodeDef of graphDef.nodes) {
      if (nodeDef.key.startsWith('__')) continue;

      const impl = this.registry.get(nodeDef.key);
      if (!impl) continue; // Already validated above, defensive check

      // When stepRecording is enabled, automatically wrap the node function
      let nodeFn: (state: any) => any = impl.run;
      if (stepRecording) {
        nodeFn = withStepRecording(nodeDef.key, impl.run, {
          persister: stepRecording.persister,
          runIdKey: stepRecording.runIdKey,
          inputSummarizer: stepRecording.inputSummarizer,
          outputSummarizer: impl.summarizeOutput,
          debug: stepRecording.debug,
        });
      }

      workflow.addNode(nodeDef.key, nodeFn);
    }

    // Group edges by source, identify conditional edges
    const edgesBySource = this.groupEdgesBySource(graphDef.edges);

    for (const [source, edges] of edgesBySource) {
      const sourceKey = this.resolveNodeKey(source);
      const impl = sourceKey ? this.registry.get(sourceKey) : null;

      // Check for conditional edges (with routeMap)
      const conditionalEdge = edges.find((e) => e.routeMap);

      if (conditionalEdge && conditionalEdge.routeMap && impl?.routes) {
        // Conditional edge: build routing function
        const routeMap = conditionalEdge.routeMap;
        const routes = impl.routes;

        const routeFn = (state: any): string => {
          for (const routeKey of Object.keys(routeMap)) {
            const predicate = routes[routeKey];
            if (predicate && predicate(state)) {
              return routeKey;
            }
          }
          // Default to the first route (fallback)
          return Object.keys(routeMap)[0];
        };

        // LangGraph StateGraph uses branded string types, dynamic keys require type assertion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        workflow.addConditionalEdges(
          sourceKey! as any,
          routeFn,
          routeMap as any,
        );
      } else {
        // Normal edges: add one by one
        for (const edge of edges) {
          const resolvedSource = this.resolveNodeKey(edge.source);
          const resolvedTarget = this.resolveNodeKey(edge.target);
          if (resolvedSource && resolvedTarget) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workflow.addEdge(resolvedSource as any, resolvedTarget as any);
          }
        }
      }
    }

    // Compile
    const compileOpts = checkpointer ? { checkpointer } : undefined;
    const graph = workflow.compile(compileOpts);

    return { graph, bindingStatus };
  }

  /**
   * Resolve __start__ / __end__ to LangGraph constants.
   */
  private resolveNodeKey(key: string): string | typeof START | typeof END {
    if (key === '__start__') return START;
    if (key === '__end__') return END;
    return key;
  }

  /**
   * Group edges by source node.
   */
  private groupEdgesBySource(
    edges: GraphEdgeDef[],
  ): Map<string, GraphEdgeDef[]> {
    const map = new Map<string, GraphEdgeDef[]>();
    for (const edge of edges) {
      const group = map.get(edge.source) || [];
      group.push(edge);
      map.set(edge.source, group);
    }
    return map;
  }
}
