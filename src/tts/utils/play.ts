import { spawn } from 'node:child_process';
import type { TTSResponse } from '@/types/tts';

export interface PlayOptions {
  player?: string;
}

export async function playAudio(response: TTSResponse, options: PlayOptions = {}): Promise<void> {
  const player = options.player || 'afplay';

  let buffer: Buffer;
  if (response.audio instanceof Buffer) {
    buffer = response.audio;
  } else if (response.audio instanceof Uint8Array) {
    buffer = Buffer.from(response.audio);
  } else {
    throw new Error('Invalid audio data');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(player, [], { stdio: ['pipe', 'inherit', 'inherit'] });
    proc.stdin.write(buffer);
    proc.stdin.end();
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Player exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}
