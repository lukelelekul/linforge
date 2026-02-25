import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // 共享 SQLite 数据库，测试文件必须顺序执行
    fileParallelism: false,
  },
});
