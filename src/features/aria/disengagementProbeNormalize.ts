export function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function normalizeApostrophes(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

export function countWords(text: string): number {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}
