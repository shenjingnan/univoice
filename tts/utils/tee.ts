import type { TTSResponse } from '../../types/tts.js';
import { collectAudio } from './collect.js';
import { playAudio } from './play.js';
import { saveAudio } from './save.js';

export interface TeeOptions {
  save?: {
    filename?: string;
    directory?: string;
  };
  play?: {
    player?: string;
  };
}

export async function teeAudio(
  response: TTSResponse,
  options: TeeOptions = {}
): Promise<TTSResponse> {
  const audio = await collectAudio(response);

  if (options.save) {
    await saveAudio({ ...response, audio }, options.save);
  }

  if (options.play) {
    await playAudio({ ...response, audio }, options.play);
  }

  return { ...response, audio };
}
