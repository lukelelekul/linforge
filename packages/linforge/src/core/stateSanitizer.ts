// stateSanitizer — LangGraph state sanitization utility
// Handles BaseMessage, function references, overly long strings, and other non-serializable values

const MAX_STRING_LENGTH = 5000;

/**
 * JSON replacer: handles non-serializable values.
 * - BaseMessage -> { _type, content, tool_calls? }
 * - Functions -> skipped (returns undefined)
 * - Overly long strings -> truncated
 */
function replacer(_key: string, value: unknown): unknown {
  // Functions -> skip
  if (typeof value === 'function') {
    return undefined;
  }

  // Overly long strings -> truncate
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return (
      value.slice(0, MAX_STRING_LENGTH) +
      `...[truncated, ${value.length} chars]`
    );
  }

  // BaseMessage detection (LangChain message objects have a _getType method)
  if (
    value !== null &&
    typeof value === 'object' &&
    '_getType' in value &&
    typeof (value as any)._getType === 'function'
  ) {
    const msg = value as any;
    const serialized: Record<string, unknown> = {
      _type: msg._getType(),
      content:
        typeof msg.content === 'string' &&
        msg.content.length > MAX_STRING_LENGTH
          ? msg.content.slice(0, MAX_STRING_LENGTH) + '...[truncated]'
          : msg.content,
    };
    if (
      msg.tool_calls &&
      Array.isArray(msg.tool_calls) &&
      msg.tool_calls.length > 0
    ) {
      serialized.tool_calls = msg.tool_calls;
    }
    return serialized;
  }

  return value;
}

/**
 * Sanitize LangGraph state into a safely JSON-serializable object.
 * Processed in a single pass via JSON.parse(JSON.stringify(state, replacer)).
 */
export function sanitizeState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(state, replacer));
  } catch {
    // Edge case (circular references, etc.) -> return shallow summary
    const fallback: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(state)) {
      if (Array.isArray(value)) {
        fallback[key] = `[Array: ${value.length} items]`;
      } else if (typeof value === 'object' && value !== null) {
        fallback[key] = `[Object: ${Object.keys(value).length} keys]`;
      } else if (typeof value === 'function') {
        // Skip functions
      } else {
        fallback[key] = value;
      }
    }
    return fallback;
  }
}
