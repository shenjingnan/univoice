import { writeFile } from 'node:fs/promises';
import type { ASRResponse } from '@/types/asr';

export interface SaveOptions {
  filename?: string;
  directory?: string;
  format?: 'txt' | 'json' | 'srt' | 'vtt';
}

export async function saveText(response: ASRResponse, options: SaveOptions = {}): Promise<string> {
  const format = options.format || 'txt';
  const timestamp = Date.now();
  const filename = options.filename || `asr_${timestamp}.${format}`;
  const filepath = options.directory ? `${options.directory}/${filename}` : filename;

  let content: string;
  if (format === 'json') {
    content = JSON.stringify(response, null, 2);
  } else if (format === 'srt' || format === 'vtt') {
    // TODO: Implement SRT/VTT formatting
    content = response.text;
  } else {
    content = response.text;
  }

  await writeFile(filepath, content, 'utf-8');
  return filepath;
}
