# linforge-adapter-prisma

Prisma adapter for [Linforge](https://github.com/lukelelekul/linforge) — production-ready Store implementations backed by [Prisma ORM](https://www.prisma.io/).

## Install

```bash
npm install linforge-adapter-prisma
# peer dependencies
npm install linforge @prisma/client
```

## Setup

### 1. Add Prisma models

Copy the models from [`prisma/schema.prisma`](./prisma/schema.prisma) into your project's Prisma schema, then run:

```bash
npx prisma db push   # or prisma migrate dev
```

### 2. Use with linforgeMiddleware

```ts
import { linforgeMiddleware } from 'linforge/server';
import { createPrismaStores } from 'linforge-adapter-prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.use(linforgeMiddleware({
  stateSchema: MyState,
  nodes: [planner, tools],
  stores: createPrismaStores(prisma),
}));
```

### 3. Selective stores (optional)

```ts
// Only use GraphStore + RunStore, skip step recording and prompt management
const stores = createPrismaStores(prisma, {
  stepPersister: false,
  promptStore: false,
});
```

## Exports

| Export | Description |
|--------|------------|
| `createPrismaStores(prisma, options?)` | Factory — creates all 4 stores in one call |
| `PrismaGraphStore` | `GraphStore` implementation |
| `PrismaRunStore` | `RunStore` implementation |
| `PrismaStepPersister` | `StepPersister` implementation |
| `PrismaPromptStore` | `PromptStore` implementation |
| `PrismaClientLike` | Minimal PrismaClient type interface |

## Database Support

The adapter uses `JSON.stringify` / `JSON.parse` for JSON fields, compatible with:

- **PostgreSQL** (native JSON/JSONB)
- **MySQL** (native JSON)
- **SQLite** (stored as TEXT)

## License

[MIT](../../LICENSE)
