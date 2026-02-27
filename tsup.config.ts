import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'src/index': 'src/index.ts',
    'src/tts/index': 'src/tts/index.ts',
    'src/asr/index': 'src/asr/index.ts',
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
  esbuildOptions(options) {
    options.alias = {
      '@/types/tts': './types/tts.d.ts',
      '@/types/asr': './types/asr.d.ts',
    };
    return options;
  },
});
