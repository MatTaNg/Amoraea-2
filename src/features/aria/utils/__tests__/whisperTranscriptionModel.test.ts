import { resolveWhisperTranscriptionModel } from '../../../../../supabase/functions/_shared/whisperTranscriptionModel';

describe('whisperTranscriptionModel (openai-whisper-proxy shared)', () => {
  it('always forces whisper-1 when client omits model', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    expect(resolveWhisperTranscriptionModel(fd)).toEqual({
      model: 'whisper-1',
      incomingModel: null,
      ignoredIncomingModel: false,
    });
  });

  it('accepts whisper-1 from client without flagging ignore', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    fd.append('model', 'whisper-1');
    expect(resolveWhisperTranscriptionModel(fd)).toEqual({
      model: 'whisper-1',
      incomingModel: 'whisper-1',
      ignoredIncomingModel: false,
    });
  });

  it('ignores non-whisper models that OpenAI rejects with Invalid URL 404', () => {
    for (const bad of ['tts-1', 'gpt-4o', 'gpt-4o-mini']) {
      const fd = new FormData();
      fd.append('file', new Blob([]), 'a.m4a');
      fd.append('model', bad);
      expect(resolveWhisperTranscriptionModel(fd)).toEqual({
        model: 'whisper-1',
        incomingModel: bad,
        ignoredIncomingModel: true,
      });
    }
  });
});
