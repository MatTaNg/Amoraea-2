import { countSpokenWords } from '@features/aria/interviewLanguageGate';
import { looksLikeName } from '@features/aria/interviewNameExtraction';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';

/**
 * During name capture, a long non-name reply is usually a misrouted scenario answer.
 * Do not persist those turns — they duplicate once the real scenario question is live.
 */
export function userTextLooksLikeSubstantivePreNameMisroute(trimmed: string): boolean {
  const t = (trimmed ?? '').trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  const wc = countSpokenWords(t);
  if (wc < 6) return false;
  if (words.length <= 3 && looksLikeName(t)) return false;
  const firstToken = resolvePlausibleInterviewFirstName(words[0] ?? '');
  if (firstToken && wc <= 4) return false;
  return true;
}

/** Failed name-capture retries should not pollute the transcript when the user answered the wrong prompt. */
export function shouldPersistNameRetryUserTurnInTranscript(trimmed: string): boolean {
  return !userTextLooksLikeSubstantivePreNameMisroute(trimmed);
}

/** Drop misrouted pre-name scenario answers before the confirmed name + briefing land. */
export function pruneOrphanedPreNameSubstantiveUserTurns(
  messages: readonly MessageWithScenario[],
): MessageWithScenario[] {
  return messages.filter((m) => {
    if (m.role !== 'user') return true;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) return true;
    return !userTextLooksLikeSubstantivePreNameMisroute((m.content ?? '').trim());
  });
}
