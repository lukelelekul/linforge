import type { StateSchema } from '@langchain/langgraph';
import type { DefineNodeOptions, InferState, NodeDefinition } from './types';

/**
 * Create a node definition.
 * Validates that key is required, returns a frozen NodeDefinition object.
 */
export function defineNode<S = any>(
  options: DefineNodeOptions<S>,
): NodeDefinition<S> {
  if (!options.key || typeof options.key !== 'string') {
    throw new Error('defineNode: key 是必填字段且必须为非空字符串');
  }

  if (typeof options.run !== 'function') {
    throw new Error(`defineNode(${options.key}): run 是必填字段且必须为函数`);
  }

  const node: NodeDefinition<S> = {
    key: options.key,
    run: options.run,
    ...(options.routes && { routes: options.routes }),
    ...(options.summarizeOutput && {
      summarizeOutput: options.summarizeOutput,
    }),
  };

  return Object.freeze(node);
}

/**
 * 工厂函数：从 StateSchema 自动绑定泛型，返回已绑定类型的 defineNode。
 * schema 参数仅用于类型推导，运行时不使用其值。
 *
 * @example
 * ```ts
 * const defineMyNode = defineNodeFor(MyState);
 * const greeter = defineMyNode({
 *   key: 'greeter',
 *   run: async (state) => ({ result: 'done' }), // ← state 自动推导
 * });
 * ```
 */
export function defineNodeFor<T extends StateSchema<any>>(
  _schema: T,
): (options: DefineNodeOptions<InferState<T>>) => NodeDefinition<InferState<T>> {
  return (options) => defineNode<InferState<T>>(options);
}
