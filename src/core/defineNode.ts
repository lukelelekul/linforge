import type { DefineNodeOptions, NodeDefinition } from './types';

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
