import { extractSalientReflectionClause } from '@features/aria/metaCommentSkipFrustration';

/** Ownership ack when client verifies they already answered the active question. */
export function buildAlreadyAnsweredOwnershipAckPrefix(priorSubstantiveText: string): string {
  const clause = extractSalientReflectionClause(priorSubstantiveText);
  if (clause) {
    const trimmed = clause.replace(/[.!?]+$/, '').trim();
    if (trimmed) {
      return `You're right — ${trimmed}. My mistake.`;
    }
  }
  return "You're right — my mistake.";
}
