import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'server/index': 'src/server/index.ts',
    'react/index': 'src/react/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.build.json',
  external: [
    // peerDependencies
    'react',
    'react-dom',
    '@xyflow/react',
    'koa',
    '@koa/router',
    // dependencies
    '@langchain/core',
    '@langchain/langgraph',
    'zod',
  ],
  splitting: false,
  sourcemap: false,
  clean: true,
  esbuildOptions(options) {
    options.legalComments = 'none';
  },
});
