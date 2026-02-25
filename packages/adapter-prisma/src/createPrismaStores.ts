import type { PrismaClientLike } from './types';
import { PrismaGraphStore } from './PrismaGraphStore';
import { PrismaRunStore } from './PrismaRunStore';
import { PrismaStepPersister } from './PrismaStepPersister';
import { PrismaPromptStore } from './PrismaPromptStore';

/** 按需选择要创建的 Store */
export interface CreatePrismaStoresOptions {
  graphStore?: boolean;
  runStore?: boolean;
  stepPersister?: boolean;
  promptStore?: boolean;
}

/** 返回值类型，与 LinforgeMiddlewareOptions['stores'] 兼容 */
export interface PrismaStores {
  graphStore?: PrismaGraphStore;
  runStore?: PrismaRunStore;
  stepPersister?: PrismaStepPersister;
  promptStore?: PrismaPromptStore;
}

/**
 * 一行创建全部 Prisma Store 实例
 *
 * @example
 * // 全部创建
 * stores: createPrismaStores(prisma)
 *
 * // 按需选择
 * stores: createPrismaStores(prisma, { stepPersister: false, promptStore: false })
 */
export function createPrismaStores(
  prisma: PrismaClientLike,
  options?: CreatePrismaStoresOptions,
): PrismaStores {
  const {
    graphStore = true,
    runStore = true,
    stepPersister = true,
    promptStore = true,
  } = options ?? {};

  return {
    ...(graphStore ? { graphStore: new PrismaGraphStore(prisma) } : {}),
    ...(runStore ? { runStore: new PrismaRunStore(prisma) } : {}),
    ...(stepPersister ? { stepPersister: new PrismaStepPersister(prisma) } : {}),
    ...(promptStore ? { promptStore: new PrismaPromptStore(prisma) } : {}),
  };
}
