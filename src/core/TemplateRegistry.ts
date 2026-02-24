import type { GraphTemplate } from './types';

/**
 * Template Registry
 * Manages built-in templates and custom registered templates
 */
export class TemplateRegistry {
  private templates = new Map<string, GraphTemplate>();

  /** Register a template */
  register(template: GraphTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(
        `TemplateRegistry: 模板 "${template.id}" 已注册，不允许重复注册`,
      );
    }
    this.templates.set(template.id, template);
  }

  /** Register multiple templates */
  registerAll(templates: GraphTemplate[]): void {
    for (const t of templates) {
      this.register(t);
    }
  }

  /** Get a template by ID */
  get(id: string): GraphTemplate | undefined {
    return this.templates.get(id);
  }

  /** Check if a template is registered */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** List all templates */
  list(): GraphTemplate[] {
    return Array.from(this.templates.values());
  }

  /** Filter templates by category */
  listByCategory(category: string): GraphTemplate[] {
    return this.list().filter((t) => t.category === category);
  }
}
