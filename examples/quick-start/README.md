# Linforge Quick Start

5 分钟跑通 Linforge 全栈示例。后端仅 ~30 行代码。

## 与 Full-Stack 示例的区别

| | Quick Start | Full-Stack |
|---|---|---|
| 后端 | `linforgeMiddleware` 一行接入 (~30 行) | 手动组装 Registry/Compiler/Stores (~240 行) |
| 前端 | 相同 (`LinforgeWorkbench`) | 相同 |
| 适合 | 快速体验、原型验证 | 理解内部结构、深度定制 |

## 运行

```bash
pnpm install
pnpm dev
```

启动后：

- Server: `http://localhost:3001` (API prefix: `/linforge`)
- Frontend: `http://localhost:5180`

## 试一试

1. 打开 `http://localhost:5180`
2. 创建一个新 Graph，应用内置模板（如 Pipeline）
3. 输入指令，点击 Run 触发运行
