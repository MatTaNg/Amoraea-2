/** Curly / typographic apostrophes and quotes → ASCII so string checks match model output. */
export function normalizeInterviewTypography(text: string): string {
  return text
    .replace(/\u2018|\u2019|\u201b/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}
