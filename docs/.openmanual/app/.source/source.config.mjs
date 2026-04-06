// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { z } from "zod";
var titleMap = {
  "index": "\u4ECB\u7ECD",
  "quickstart": "\u5FEB\u901F\u4E0A\u624B",
  "audio-format-performance": "\u97F3\u9891\u683C\u5F0F\u6027\u80FD\u5206\u6790",
  "doubao/tts-guide": "TTS \u4F7F\u7528\u6307\u5357",
  "doubao/asr-guide": "ASR \u4F7F\u7528\u6307\u5357",
  "glm/tts-guide": "TTS \u4F7F\u7528\u6307\u5357",
  "glm/\u6587\u5B57\u8F6C\u8BED\u97F3": "API \u53C2\u8003",
  "glm/asr-guide": "ASR \u4F7F\u7528\u6307\u5357",
  "qwen/tts-guide": "TTS \u4F7F\u7528\u6307\u5357",
  "qwen/asr-guide": "ASR \u4F7F\u7528\u6307\u5357",
  "qwen/realtime-tts-guide": "Realtime TTS \u4F7F\u7528\u6307\u5357"
};
var allowedSlugs = /* @__PURE__ */ new Set(["index", "quickstart", "audio-format-performance", "doubao/tts-guide", "doubao/asr-guide", "glm/tts-guide", "glm/\u6587\u5B57\u8F6C\u8BED\u97F3", "glm/asr-guide", "qwen/tts-guide", "qwen/asr-guide", "qwen/realtime-tts-guide"]);
function slugFromPath(path) {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.indexOf("content/");
  const relative = idx >= 0 ? normalized.slice(idx + "content/".length) : normalized;
  return relative.replace(/\.(md|mdx)$/i, "");
}
function titleFromPath(path) {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.indexOf("content/");
  const relative = idx >= 0 ? normalized.slice(idx + "content/".length) : normalized;
  const slug = relative.replace(/\.(md|mdx)$/i, "");
  return titleMap[slug] || slug.split("/").pop() || slug;
}
var docs = defineDocs({
  dir: "content",
  docs: {
    schema: (ctx) => z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      full: z.boolean().optional()
    }).transform((data) => ({
      ...data,
      title: data.title ?? titleFromPath(ctx.path)
    })).refine((_data) => {
      const slug = slugFromPath(ctx.path);
      if (allowedSlugs.size > 0 && !allowedSlugs.has(slug)) {
        return false;
      }
      return true;
    })
  }
});
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
    rehypeCodeOptions: {
      themes: {
        light: "github-light",
        dark: "github-dark"
      },
      defaultColor: false,
      fallbackLanguage: "text"
    }
  }
});
export {
  source_config_default as default,
  docs
};
