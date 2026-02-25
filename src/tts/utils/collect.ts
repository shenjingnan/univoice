import { Buffer } from 'node:buffer';
import type { TTSResponse } from '@/types/tts';

export interface CollectOptions {
  onChunk?: (chunk: Uint8Array) => void;
  onComplete?: (audio: Uint8Array) => void;
  onError?: (error: Error) => void;
}

export async function collectAudio(
  response: TTSResponse,
  options: CollectOptions = {}
): Promise<Uint8Array> {
  const { audio } = response;
  const chunks: Uint8Array[] = [];

  if (isUint8Array(audio)) {
    chunks.push(audio);
  } else if (isBuffer(audio)) {
    chunks.push(new Uint8Array(audio));
  }

  const result = concatUint8Arrays(chunks);

  if (options.onComplete) {
    options.onComplete(result);
  }

  return result;
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isBuffer(value: unknown): value is Buffer {
  return Buffer.isBuffer(value);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
