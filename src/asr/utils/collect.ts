import type { ASRResponse } from '@/types/asr';

export interface CollectOptions {
  onSegment?: (segment: string) => void;
  onComplete?: (text: string) => void;
}

export async function collectText(
  response: ASRResponse,
  options: CollectOptions = {}
): Promise<string> {
  const { text } = response;

  if (options.onSegment && response.segments) {
    for (const segment of response.segments) {
      options.onSegment(segment.text);
    }
  }

  if (options.onComplete) {
    options.onComplete(text);
  }

  return text;
}
