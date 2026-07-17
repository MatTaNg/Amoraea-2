import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import { isElevenLabsEnabledForEnvironment } from '@features/aria/utils/elevenLabsTtsAvailability';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { shouldUseDefaultVoiceInsteadOfElevenLabs } from '@features/aria/utils/interviewTtsDevAccount';

let afterModalPrefetch: { text: string; buffer: ArrayBuffer } | null = null;

/** Fire-and-forget ElevenLabs prefetch while the emotion modal is open. */
export function kickOffEmotionTransitionAfterModalPrefetch(text: string): void {
  const raw = (text ?? '').trim();
  if (!raw) return;
  if (shouldUseDefaultVoiceInsteadOfElevenLabs() || !isElevenLabsEnabledForEnvironment()) return;
  const spoken = substituteCanonicalInterviewScenarioBodiesForTts(raw);
  if (!spoken) return;
  void fetchElevenLabsMpegArrayBuffer(spoken).then((buffer) => {
    if (buffer?.byteLength) {
      afterModalPrefetch = { text: spoken, buffer };
    }
  });
}

export function takeEmotionTransitionAfterModalPrefetch(text: string): ArrayBuffer | null {
  const spoken = substituteCanonicalInterviewScenarioBodiesForTts((text ?? '').trim());
  if (!spoken || afterModalPrefetch?.text !== spoken) return null;
  const buffer = afterModalPrefetch.buffer;
  afterModalPrefetch = null;
  return buffer;
}

export function clearEmotionTransitionAfterModalPrefetch(): void {
  afterModalPrefetch = null;
}
