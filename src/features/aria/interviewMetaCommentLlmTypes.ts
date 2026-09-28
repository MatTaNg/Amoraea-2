import type { ConfusionSubtype, MetaCommentType } from '@features/aria/metaCommentClassificationTypes';

/** LLM meta labels — includes non-meta outcomes the heuristic bucket mislabels. */
export type MetaCommentLlmLabel =
  | MetaCommentType
  | 'none'
  | 'substantive_answer'
  | 'cut_off';

export type MetaCommentLlmResult = {
  metaType: MetaCommentLlmLabel;
  confidence: number;
  confusionSubtype?: ConfusionSubtype;
  reason: string;
};
