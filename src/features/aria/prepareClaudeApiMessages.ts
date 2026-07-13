export type ClaudeApiMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Anthropic Messages API requires the conversation to end with a user turn.
 * Strip empty turns and trailing assistant messages before the request.
 */
export function prepareClaudeApiMessages(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): ClaudeApiMessage[] {
  const filtered = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: (m.content ?? '').trim(),
    }))
    .filter((m) => m.content.length > 0);

  while (filtered.length > 0 && filtered[filtered.length - 1].role === 'assistant') {
    filtered.pop();
  }

  if (filtered.length === 0 || filtered[filtered.length - 1].role !== 'user') {
    const err = new Error('Conversation must end with a user message before calling Claude.');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  return filtered;
}
