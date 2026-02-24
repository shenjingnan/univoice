import { writeFile } from 'node:fs/promises';
import type { TTSResponse } from '../../types/tts.js';

export interface SaveOptions {
  filename?: string;
  directory?: string;
}

export async function saveAudio(response: TTSResponse, options: SaveOptions = {}): Promise<string> {
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
