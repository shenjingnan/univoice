// @ts-nocheck
import * as __fd_glob_12 from "../content/qwen/tts-guide.mdx?collection=docs"
import * as __fd_glob_11 from "../content/qwen/realtime-tts-guide.mdx?collection=docs"
import * as __fd_glob_10 from "../content/qwen/asr-guide.mdx?collection=docs"
import * as __fd_glob_9 from "../content/glm/tts-guide.mdx?collection=docs"
import * as __fd_glob_8 from "../content/glm/asr-guide.mdx?collection=docs"
import * as __fd_glob_7 from "../content/doubao/tts-guide.mdx?collection=docs"
import * as __fd_glob_6 from "../content/doubao/asr-guide.mdx?collection=docs"
import * as __fd_glob_5 from "../content/quickstart.mdx?collection=docs"
import * as __fd_glob_4 from "../content/index.mdx?collection=docs"
import * as __fd_glob_3 from "../content/audio-format-performance.mdx?collection=docs"
import { default as __fd_glob_2 } from "../content/qwen/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/doubao/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/glm/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content", {"glm/meta.json": __fd_glob_0, "doubao/meta.json": __fd_glob_1, "qwen/meta.json": __fd_glob_2, }, {"audio-format-performance.mdx": __fd_glob_3, "index.mdx": __fd_glob_4, "quickstart.mdx": __fd_glob_5, "doubao/asr-guide.mdx": __fd_glob_6, "doubao/tts-guide.mdx": __fd_glob_7, "glm/asr-guide.mdx": __fd_glob_8, "glm/tts-guide.mdx": __fd_glob_9, "qwen/asr-guide.mdx": __fd_glob_10, "qwen/realtime-tts-guide.mdx": __fd_glob_11, "qwen/tts-guide.mdx": __fd_glob_12, });