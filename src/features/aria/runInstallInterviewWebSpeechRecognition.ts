import type {
  InterviewWebSpeechRecognitionDeps,
  InterviewWebSpeechRecognitionInstance,
} from '@features/aria/interviewWebSpeechRecognitionTypes';

/** Web: browser SpeechRecognition (hold-to-talk fallback when Whisper/MediaRecorder is off). */
export function runInstallInterviewWebSpeechRecognition(
  deps: InterviewWebSpeechRecognitionDeps,
): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined;
  if (deps.useMediaRecorderPath) {
    deps.setMicError((prev) =>
      prev === 'Speech recognition is not supported. Please use Chrome or Safari.' ? null : prev,
    );
    return undefined;
  }
  const SR = (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
  if (!SR) {
    deps.setMicError('Speech recognition is not supported. Please use Chrome or Safari.');
    return undefined;
  }
  const rec = new SR() as InterviewWebSpeechRecognitionInstance;
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.maxAlternatives = 1;
  rec.onresult = (e: unknown) => {
    const ev = e as {
      resultIndex: number;
      results: Array<{ isFinal: boolean; [i: number]: { transcript?: string } }>;
    };
    let interim = '';
    let final = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const t = (r && typeof r === 'object' && r[0]?.transcript) ?? '';
      if (r?.isFinal) final += t;
      else interim += t;
    }
    deps.setCurrentTranscript((prev) => (final || interim || prev).trim());
    deps.transcriptAtReleaseRef.current = (final || interim).trim();
  };
  rec.onerror = (e) => {
    console.log('<---e', e);
    if (e.error === 'not-allowed') {
      deps.setMicError('Microphone access was denied.');
    } else if (e.error === 'aborted') {
      // User or we stopped; ignore
    } else if (e.error === 'network' || e.error === 'no-speech') {
      deps.setMicWarning(
        e.error === 'network'
          ? 'Connection problem. Check your internet and try again.'
          : 'No speech heard. Try again when ready.',
      );
    } else {
      deps.setMicError(`Microphone error: ${e.error}`);
    }
  };
  deps.recognitionRef.current = rec;
  return () => {
    try {
      rec.stop();
    } catch {
      /* non-fatal */
    }
  };
}
