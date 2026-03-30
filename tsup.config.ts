import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'src/index': 'src/index.ts',
    'src/tts/index': 'src/tts/index.ts',
    'src/asr/index': 'src/asr/index.ts',
    'src/tts/providers/index': 'src/tts/providers/index.ts',
    'src/asr/providers/index': 'src/asr/providers/index.ts',
  },
  outDir: 'dist',
  format: 'esm',
  target: 'node20',
  dts: true,
  sourcemap: true,
  minify: false,
  clean: true,
  keepNames: true,
  platform: 'node',
  treeshake: true,
  splitting: true,
  external: ['prism-media'],
});
