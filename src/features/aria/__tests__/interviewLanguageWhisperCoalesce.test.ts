import { WHISPER_LANGUAGE } from '@features/aria/config/whisperApiConstants';
import { parseWhisperTranscriptionPayload } from '@features/aria/interviewLanguageGate';

/** Mirrors AriaScreen transcribe path: use Whisper language when present, else session default. */
function coalesceWhisperLanguageForSession(parsed: ReturnType<typeof parseWhisperTranscriptionPayload>): string {
  return parsed.language ?? WHISPER_LANGUAGE;
}

describe('Whisper transcription language coalescing (session default)', () => {
  it('uses API language when present', () => {
    const p = parseWhisperTranscriptionPayload({ text: 'hello', language: 'es' });
    expect(coalesceWhisperLanguageForSession(p)).toBe('es');
  });

  it('falls back to WHISPER_LANGUAGE when API omits language', () => {
    const p = parseWhisperTranscriptionPayload({ text: 'hello' });
    expect(coalesceWhisperLanguageForSession(p)).toBe(WHISPER_LANGUAGE);
    expect(coalesceWhisperLanguageForSession(p)).toBe('en');
  });
});
