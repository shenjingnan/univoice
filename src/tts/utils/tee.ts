import { collectAudio } from '@/tts/utils/collect';
import { playAudio } from '@/tts/utils/play';
import { saveTTSResponse } from '@/tts/utils/save';
import type { TTSResponse } from '@/types/tts';

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
    await saveTTSResponse({ ...response, audio }, options.save);
  }

  if (options.play) {
    await playAudio({ ...response, audio }, options.play);
  }

  return { ...response, audio };
}
