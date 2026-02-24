// stateDiff — shallow diff utility
// Compares top-level keys of stateBefore and stateAfter, returns a list of changes

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffEntry {
  key: string;
  type: DiffType;
  before?: unknown;
  after?: unknown;
}

/**
 * Compute a shallow diff between two state snapshots (top-level keys only).
 * Used for change highlighting in the State snapshot panel.
 */
export function computeStateDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const entries: DiffEntry[] = [];

  for (const key of allKeys) {
    const hasBefore = key in before;
    const hasAfter = key in after;

    if (!hasBefore && hasAfter) {
      entries.push({ key, type: 'added', after: after[key] });
    } else if (hasBefore && !hasAfter) {
      entries.push({ key, type: 'removed', before: before[key] });
    } else {
      // Both sides have the key — compare via JSON stringify (simple and reliable for shallow diff)
      const bStr = JSON.stringify(before[key]);
      const aStr = JSON.stringify(after[key]);
      if (bStr !== aStr) {
        entries.push({
          key,
          type: 'changed',
          before: before[key],
          after: after[key],
        });
      } else {
        entries.push({
          key,
          type: 'unchanged',
          before: before[key],
          after: after[key],
        });
      }
    }
  }

  return entries;
}
