import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.build.json',
  external: [
    'linforge',
    '@prisma/client',
  ],
  splitting: false,
  sourcemap: false,
  clean: true,
  esbuildOptions(options) {
    options.legalComments = 'none';
  },
});
