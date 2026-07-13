export type {
  ConfusionSubtype,
  ExemptMetaCommentTurnReason,
  FrustrationMetaSuppressionDecision,
  FrustrationMetaSuppressionReason,
  InabilityOverrideDetail,
  InabilityOverrideTrigger,
  MetaCommentClassification,
  MetaCommentType,
  ResolvedMetaComment,
} from '@features/aria/metaCommentClassificationTypes';
export {
  FRUSTRATION_META_CONFIDENCE_THRESHOLD,
  FRUSTRATION_META_WORD_COUNT_THRESHOLD,
} from '@features/aria/metaCommentClassificationTypes';

export {
  classifyUserMetaComment,
  countsAsSubstantiveInterviewQuestionDelivery,
  getInabilitySubstantiveOverrideDetail,
  getMetaCommentCanonicalResponseSummary,
  getPriorSubstantiveNonMetaUserContentInMoment,
} from '@features/aria/metaCommentClassifierCore';

export {
  evaluateFrustrationMetaCommentPathSuppression,
  isCheckingInFrustrationAdjacent,
  looksLikeShortNameReply,
  resolveMetaCommentForInterviewTurn,
} from '@features/aria/metaCommentTurnGating';

export { buildMetaCommentHandlingSuffix } from '@features/aria/metaCommentHandlingSuffix';
export * from '@features/aria/metaCommentConfusionRepeat';
export * from '@features/aria/metaCommentSkipFrustration';
