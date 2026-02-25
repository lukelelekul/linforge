/**
 * JSON 字段序列化/反序列化辅助
 *
 * PostgreSQL/MySQL 的 Json 类型可以直接接收对象或字符串；
 * SQLite 无原生 Json，Schema 中用 String 类型，必须手动序列化。
 * 统一使用 JSON.stringify 写入、解析读取，兼容所有数据库。
 */

/** 写入时：对象 -> JSON 字符串 */
export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

/** 写入时：可选字段 */
export function toJsonOrNull(value: unknown): string | null {
  return value != null ? JSON.stringify(value) : null;
}

/** 读取时：JSON 字符串 -> 对象（兼容已经是对象的情况） */
export function fromJson<T = any>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value);
  return value as T;
}

/** 读取时：可选字段 */
export function fromJsonOrUndefined<T = any>(value: unknown): T | undefined {
  if (value == null) return undefined;
  return fromJson<T>(value);
}
