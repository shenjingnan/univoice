import { writeFile } from 'node:fs/promises';
import type { TTSResponse } from '@/types/tts';

export interface SaveOptions {
  filename?: string;
  directory?: string;
}

/**
 * 保存 TTSResponse 到文件
 * 自动生成文件名，适合快速保存 TTS 响应
 *
 * @param response TTS 响应对象
 * @param options 保存选项
 * @returns 保存的文件路径
 */
export async function saveTTSResponse(
  response: TTSResponse,
  options: SaveOptions = {}
): Promise<string> {
  const { format } = response;
  const timestamp = Date.now();
  const filename = options.filename || `tts_${timestamp}.${format}`;
  const filepath = options.directory ? `${options.directory}/${filename}` : filename;

  let buffer: Buffer;
  if (response.audio instanceof Buffer) {
    buffer = response.audio;
  } else if (response.audio instanceof Uint8Array) {
    buffer = Buffer.from(response.audio);
  } else {
    throw new Error('Invalid audio data');
  }

  await writeFile(filepath, buffer);
  return filepath;
}
