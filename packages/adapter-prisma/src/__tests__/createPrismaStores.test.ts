import { describe, it, expect } from 'vitest';
import { createPrismaStores } from '../createPrismaStores';
import { PrismaGraphStore } from '../PrismaGraphStore';
import { PrismaRunStore } from '../PrismaRunStore';
import { PrismaStepPersister } from '../PrismaStepPersister';
import { PrismaPromptStore } from '../PrismaPromptStore';
import type { PrismaClientLike } from '../types';

// 假 PrismaClient，只用于验证工厂函数实例化逻辑
const fakePrisma = {} as PrismaClientLike;

describe('createPrismaStores', () => {
  it('默认创建全部 4 个 Store', () => {
    const stores = createPrismaStores(fakePrisma);
    expect(stores.graphStore).toBeInstanceOf(PrismaGraphStore);
    expect(stores.runStore).toBeInstanceOf(PrismaRunStore);
    expect(stores.stepPersister).toBeInstanceOf(PrismaStepPersister);
    expect(stores.promptStore).toBeInstanceOf(PrismaPromptStore);
  });

  it('可以禁用部分 Store', () => {
    const stores = createPrismaStores(fakePrisma, {
      stepPersister: false,
      promptStore: false,
    });
    expect(stores.graphStore).toBeInstanceOf(PrismaGraphStore);
    expect(stores.runStore).toBeInstanceOf(PrismaRunStore);
    expect(stores.stepPersister).toBeUndefined();
    expect(stores.promptStore).toBeUndefined();
  });

  it('全部禁用返回空对象', () => {
    const stores = createPrismaStores(fakePrisma, {
      graphStore: false,
      runStore: false,
      stepPersister: false,
      promptStore: false,
    });
    expect(Object.keys(stores)).toHaveLength(0);
  });

  it('只启用单个 Store', () => {
    const stores = createPrismaStores(fakePrisma, {
      graphStore: true,
      runStore: false,
      stepPersister: false,
      promptStore: false,
    });
    expect(stores.graphStore).toBeInstanceOf(PrismaGraphStore);
    expect(stores.runStore).toBeUndefined();
    expect(stores.stepPersister).toBeUndefined();
    expect(stores.promptStore).toBeUndefined();
  });
});
