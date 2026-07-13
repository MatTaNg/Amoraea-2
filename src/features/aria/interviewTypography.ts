/** Curly / typographic apostrophes and quotes → ASCII so string checks match model output. */
export function normalizeInterviewTypography(text: string): string {
  return text
    .replace(/\u2018|\u2019|\u201b/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}

/** Model/TTS often emit U+2019 (') instead of ASCII ' in What's, could've, etc. */
export function normalizeApostrophesForPromptMatch(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}
