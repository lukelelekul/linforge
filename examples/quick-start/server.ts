// Linforge Quick Start — 最小全栈示例
//
// 用 linforgeMiddleware 一行接入，~30 行跑通后端。
// 完整手动组装示例参见 ../full-stack/server.ts

import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNode } from 'linforge/core';
import { linforgeMiddleware } from 'linforge/server';

// 1. 定义 State（不需要手动添加 agentRunId，middleware 自动注入）
const MyState = new StateSchema({
  messages: z.array(z.string()).default([]),
  result: z.string().default(''),
});

// 2. 定义 Nodes
const greeter = defineNode({
  key: 'greeter',
  label: 'Greeter',
  run: async (state: any) => ({
    messages: [...state.messages, '[greeter] Hello!'],
    result: 'Greeting complete.',
  }),
});

// 3. 启动服务器
const app = new Koa();
app.use(cors());
app.use(bodyParser());
app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [greeter],
}));

app.listen(3001, () => {
  console.log('Linforge quick-start server running at http://localhost:3001');
  console.log('API prefix: /linforge');
});
