let elevenLabsPreviousTextContext = '';

export function takePreviousTextForElevenLabsRequest(): string | undefined {
  const prev = elevenLabsPreviousTextContext.trim();
  if (!prev) return undefined;
  return prev.slice(-200);
}

export function recordElevenLabsSpokenContext(text: string): void {
  const t = text.trim();
  if (!t) return;
  elevenLabsPreviousTextContext = t.slice(-300);
}

export function resetElevenLabsSpokenContext(): void {
  elevenLabsPreviousTextContext = '';
}
