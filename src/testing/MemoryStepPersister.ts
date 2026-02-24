import type { StepData, StepPersister } from '../core/types';

/**
 * In-memory step persister adapter
 * For testing and example projects
 */
export class MemoryStepPersister implements StepPersister {
  private steps = new Map<string, StepData[]>();

  async createStep(data: StepData): Promise<void> {
    const list = this.steps.get(data.agentRunId) ?? [];
    list.push(data);
    this.steps.set(data.agentRunId, list);
  }

  /** Query all steps for a given run */
  async getSteps(runId: string): Promise<StepData[]> {
    return this.steps.get(runId) ?? [];
  }

  /** Clear all data */
  clear(): void {
    this.steps.clear();
  }
}
