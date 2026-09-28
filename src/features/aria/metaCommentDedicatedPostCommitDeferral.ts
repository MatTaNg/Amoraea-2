import { looksLikePriorAnswerMetaComment } from '@features/aria/interviewPriorAnswerMetaDetection';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { looksLikeClearSkipRequestPhrase } from '@features/aria/metaCommentPatternScoring';
import { moment4UserDeclinesSpecificityReask } from '@features/aria/moment4SpecificityFollowUp';

/** Meta types handled after construct/M5 inject gates — skip confirmation, checking-in, etc. */
export const META_TYPES_WITH_DEDICATED_POST_COMMIT_HANDLING = new Set<
  NonNullable<MetaCommentClassification['type']>
>(['skip_request', 'inability', 'frustration', 'already_answered', 'checking_in', 'confusion']);

/** True when dedicated post-commit meta gates should run instead of construct/M5 inject handling. */
export function shouldDeferGatesForDedicatedMetaHandling(
  metaCommentClassification: MetaCommentClassification | null,
  trimmed: string,
): boolean {
  if (looksLikePriorAnswerMetaComment(trimmed)) {
    return true;
  }
  // Phrase-first: "Can I skip this question?" must never trigger M5 accountability.
  if (looksLikeClearSkipRequestPhrase(trimmed)) {
    return true;
  }
  if (
    metaCommentClassification?.type &&
    META_TYPES_WITH_DEDICATED_POST_COMMIT_HANDLING.has(metaCommentClassification.type)
  ) {
    return true;
  }
  if (moment4UserDeclinesSpecificityReask(trimmed)) {
    return true;
  }
  return false;
}
