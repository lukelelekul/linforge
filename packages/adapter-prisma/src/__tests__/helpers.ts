import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../prisma/test.db');

/** 创建测试用的 PrismaClient 实例，连接 SQLite test.db */
export function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: `file:${dbPath}`,
  });
}

/** 清空所有测试数据 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('DELETE FROM linforge_steps');
  await prisma.$executeRawUnsafe('DELETE FROM linforge_runs');
  await prisma.$executeRawUnsafe('DELETE FROM linforge_graphs');
  await prisma.$executeRawUnsafe('DELETE FROM linforge_prompt_versions');
}
