/**
 * 最小 PrismaClient 类型定义
 * 避免直接依赖 @prisma/client 的生成产物，让 adapter 包独立编译。
 * 用户传入的实际 PrismaClient 实例是生成后的完整类型，运行时兼容。
 */
export interface PrismaClientLike {
  $transaction(operations: any[]): Promise<any>;
  [key: string]: any;
}
