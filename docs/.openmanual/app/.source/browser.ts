// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"audio-format-performance.mdx": () => import("../content/audio-format-performance.mdx?collection=docs"), "index.mdx": () => import("../content/index.mdx?collection=docs"), "quickstart.mdx": () => import("../content/quickstart.mdx?collection=docs"), "doubao/asr-guide.mdx": () => import("../content/doubao/asr-guide.mdx?collection=docs"), "doubao/tts-guide.mdx": () => import("../content/doubao/tts-guide.mdx?collection=docs"), "glm/asr-guide.mdx": () => import("../content/glm/asr-guide.mdx?collection=docs"), "glm/tts-guide.mdx": () => import("../content/glm/tts-guide.mdx?collection=docs"), "qwen/asr-guide.mdx": () => import("../content/qwen/asr-guide.mdx?collection=docs"), "qwen/realtime-tts-guide.mdx": () => import("../content/qwen/realtime-tts-guide.mdx?collection=docs"), "qwen/tts-guide.mdx": () => import("../content/qwen/tts-guide.mdx?collection=docs"), }),
};
export default browserCollections;