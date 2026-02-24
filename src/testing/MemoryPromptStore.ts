import type {
  PromptStore,
  PromptVersion,
  CreatePromptVersionInput,
} from '../core/types';

/**
 * In-memory prompt store adapter
 * For testing and example projects
 */
export class MemoryPromptStore implements PromptStore {
  /** All versions stored grouped by nodeId */
  private versions = new Map<string, PromptVersion[]>();

  async getActivePrompt(nodeId: string): Promise<PromptVersion | null> {
    const list = this.versions.get(nodeId);
    if (!list) return null;
    return list.find((v) => v.isActive) ?? null;
  }

  async listVersions(nodeId: string): Promise<PromptVersion[]> {
    const list = this.versions.get(nodeId) ?? [];
    // Sort by version desc
    return [...list].sort((a, b) => b.version - a.version);
  }

  async createVersion(
    nodeId: string,
    data: CreatePromptVersionInput,
  ): Promise<PromptVersion> {
    const list = this.versions.get(nodeId) ?? [];

    // Auto-increment version: current max version + 1
    const maxVersion = list.reduce((max, v) => Math.max(max, v.version), 0);

    const newVersion: PromptVersion = {
      id: `prompt_${nodeId}_v${maxVersion + 1}`,
      nodeId,
      version: maxVersion + 1,
      template: data.template,
      temperature: data.temperature ?? 0.3,
      isActive: false,
      createdAt: new Date(),
    };

    list.push(newVersion);
    this.versions.set(nodeId, list);
    return newVersion;
  }

  async activateVersion(nodeId: string, versionId: string): Promise<void> {
    const list = this.versions.get(nodeId);
    if (!list) throw new Error(`No versions found for nodeId: ${nodeId}`);

    const target = list.find((v) => v.id === versionId);
    if (!target) throw new Error(`Version not found: ${versionId}`);

    // Mutual exclusion within same nodeId: deactivate all, then activate target
    for (const v of list) {
      v.isActive = v.id === versionId;
    }
  }

  /** Convenience method: directly set the active prompt for a node (for testing) */
  setPrompt(nodeId: string, template: string, temperature = 0.3): void {
    const list = this.versions.get(nodeId) ?? [];

    // Deactivate all current versions
    for (const v of list) {
      v.isActive = false;
    }

    const maxVersion = list.reduce((max, v) => Math.max(max, v.version), 0);
    const newVersion: PromptVersion = {
      id: `prompt_${nodeId}_v${maxVersion + 1}`,
      nodeId,
      version: maxVersion + 1,
      template,
      temperature,
      isActive: true,
      createdAt: new Date(),
    };

    list.push(newVersion);
    this.versions.set(nodeId, list);
  }

  /** Clear all data */
  clear(): void {
    this.versions.clear();
  }
}
