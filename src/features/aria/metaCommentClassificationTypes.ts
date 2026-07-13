export type MetaCommentType =
  | 'frustration'
  | 'confusion'
  | 'checking_in'
  | 'skip_request'
  | 'inability'
  | 'already_answered'
  | 'ambiguous_short';

export type ConfusionSubtype = 'repeat_request';

export type MetaCommentClassification = {
  type: MetaCommentType;
  confidence: number;
  confusion_subtype?: ConfusionSubtype;
};

export type InabilityOverrideTrigger =
  | 'character_name_detected'
  | 'behavioral_observation_detected'
  | 'word_count_fallback';

export type InabilityOverrideDetail = {
  inability_override_fired: true;
  override_trigger: InabilityOverrideTrigger;
  full_response_word_count: number;
};

export type ExemptMetaCommentTurnReason =
  | 'name_entry_turn'
  | 'preamble_readiness_turn'
  | 'resume_reentry_turn'
  | 'exit_decline_turn'
  | 'post_meta_ack_window_active'
  | 'seq_not_advanced_since_last_ack'
  | 'no_exemption_condition_met';

export type ResolvedMetaComment = {
  raw: MetaCommentClassification | null;
  effective: MetaCommentClassification | null;
  exemptMetaCommentTurn: boolean;
  exemptMetaCommentTurnReason: ExemptMetaCommentTurnReason;
};

export type FrustrationMetaSuppressionReason =
  | 'word_count_above_threshold'
  | 'confidence_below_0.85';

export type FrustrationMetaSuppressionDecision = {
  suppress: boolean;
  reason: FrustrationMetaSuppressionReason | null;
  suppressionEventType:
    | 'meta_comment_suppressed_word_count_guard'
    | 'meta_comment_suppressed_confidence_threshold'
    | null;
};

export const FRUSTRATION_META_CONFIDENCE_THRESHOLD = 0.85;
export const FRUSTRATION_META_WORD_COUNT_THRESHOLD = 40;
