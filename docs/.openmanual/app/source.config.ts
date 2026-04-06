import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

const titleMap: Record<string, string> = {
  'index': '介绍',
  'quickstart': '快速上手',
  'audio-format-performance': '音频格式性能分析',
  'doubao/tts-guide': 'TTS 使用指南',
  'doubao/asr-guide': 'ASR 使用指南',
  'glm/tts-guide': 'TTS 使用指南',
  'glm/文字转语音': 'API 参考',
  'glm/asr-guide': 'ASR 使用指南',
  'qwen/tts-guide': 'TTS 使用指南',
  'qwen/asr-guide': 'ASR 使用指南',
  'qwen/realtime-tts-guide': 'Realtime TTS 使用指南'
};

const allowedSlugs = new Set(["index","quickstart","audio-format-performance","doubao/tts-guide","doubao/asr-guide","glm/tts-guide","glm/文字转语音","glm/asr-guide","qwen/tts-guide","qwen/asr-guide","qwen/realtime-tts-guide"]);

function slugFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.indexOf('content/');
  const relative = idx >= 0 ? normalized.slice(idx + 'content/'.length) : normalized;
  return relative.replace(/\.(md|mdx)$/i, '');
}

function titleFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.indexOf('content/');
  const relative = idx >= 0 ? normalized.slice(idx + 'content/'.length) : normalized;
  const slug = relative.replace(/\.(md|mdx)$/i, '');
  return titleMap[slug] || slug.split('/').pop() || slug;
}

export const docs = defineDocs({
  dir: 'content',
  docs: {
    schema: (ctx) =>
      z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        full: z.boolean().optional(),
      }).transform((data) => ({
        ...data,
        title: data.title ?? titleFromPath(ctx.path),
      }))
      .refine((_data) => {
        const slug = slugFromPath(ctx.path);
        if (allowedSlugs.size > 0 && !allowedSlugs.has(slug)) {
          return false;
        }
        return true;
      }),
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      fallbackLanguage: 'text',
    },
  },
});
