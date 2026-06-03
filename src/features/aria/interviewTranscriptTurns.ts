/**
 * Helpers for building interview transcript rows — never persist empty assistant speech.
 */

export type TranscriptTurn = {
  role: string;
  content?: string | null;
  scenarioNumber?: number;
  interviewMoment?: number;
  [key: string]: unknown;
};

export function assistantTurnHasPersistableContent(content: string | null | undefined): boolean {
  return typeof content === 'string' && content.trim().length > 0;
}

/**
 * Append an assistant turn only when content is non-empty (after trim).
 * Returns the same array reference when skipped so callers can branch on length.
 */
export function appendAssistantTurn<T extends TranscriptTurn>(
  transcript: T[],
  content: string,
  metadata: Partial<T> = {},
): T[] {
  if (!assistantTurnHasPersistableContent(content)) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Transcript] Skipping empty assistant turn — metadata:', metadata);
    }
    return transcript;
  }
  return [
    ...transcript,
    {
      role: 'assistant',
      content,
      ...metadata,
    } as T,
  ];
}

/**
 * Append assistant output when `liveTranscript` may include concurrent user turns
 * added after `turnSnapshot` was captured at the start of an API round-trip.
 */
export function appendAssistantTurnMergingConcurrentUsers<T extends TranscriptTurn>(
  liveTranscript: T[],
  turnSnapshot: T[],
  content: string,
  metadata: Partial<T> = {},
): T[] {
  if (!assistantTurnHasPersistableContent(content)) {
    return liveTranscript.length >= turnSnapshot.length ? liveTranscript : turnSnapshot;
  }
  if (liveTranscript.length <= turnSnapshot.length) {
    return appendAssistantTurn(turnSnapshot, content, metadata);
  }
  const snapUserCount = turnSnapshot.filter((m) => m.role === 'user').length;
  const liveUserCount = liveTranscript.filter((m) => m.role === 'user').length;
  if (liveUserCount >= snapUserCount) {
    return appendAssistantTurn(liveTranscript, content, metadata);
  }
  return appendAssistantTurn(turnSnapshot, content, metadata);
}

/** Display label for admin / debug UIs when a legacy row has no content. */
export function formatTranscriptTurnContentForDisplay(
  role: string,
  content: string | null | undefined,
): string {
  const trimmed = (content ?? '').trim();
  if (trimmed) return trimmed;
  if (role === 'assistant') return '(empty assistant turn)';
  return '';
}
