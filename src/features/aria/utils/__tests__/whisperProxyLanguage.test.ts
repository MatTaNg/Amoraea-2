import {
  formFieldString,
  resolveIncomingWhisperLanguage,
} from '../../../../../supabase/functions/_shared/whisperProxyLanguage';

describe('whisperProxyLanguage (openai-whisper-proxy shared)', () => {
  const url = 'https://example.supabase.co/functions/v1/openai-whisper-proxy';

  it('reads language from query string', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    const u = `${url}?language=en`;
    expect(resolveIncomingWhisperLanguage(fd, u)).toBe('en');
  });

  it('prefers language_parameter in query over form', () => {
    const fd = new FormData();
    fd.append('language', 'fr');
    fd.append('file', new Blob([]), 'a.m4a');
    const u = `${url}?language_parameter=en`;
    expect(resolveIncomingWhisperLanguage(fd, u)).toBe('en');
  });

  it('reads language from multipart field', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    fd.append('language', 'en');
    expect(resolveIncomingWhisperLanguage(fd, url)).toBe('en');
  });

  it('reads language_parameter from form when language absent', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    fd.append('language_parameter', 'en');
    expect(resolveIncomingWhisperLanguage(fd, url)).toBe('en');
  });

  it('matches case-insensitive form keys', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    fd.append('Language', 'en');
    expect(resolveIncomingWhisperLanguage(fd, url)).toBe('en');
  });

  it('returns undefined when no language anywhere', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    fd.append('model', 'whisper-1');
    expect(resolveIncomingWhisperLanguage(fd, url)).toBeUndefined();
  });

  it('formFieldString ignores File entries', () => {
    const fd = new FormData();
    fd.append('file', new Blob([]), 'a.m4a');
    expect(formFieldString(fd, 'language')).toBeUndefined();
  });
});
