import type { MutableRefObject } from 'react';

import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';

export type InterviewAssistantMetaExemptionDeps = {
  substantiveInterviewQuestionDeliveredSeqRef: MutableRefObject<number>;
  metaCommentAckAwaitingSubstantiveBaselineSeqRef: MutableRefObject<number | null>;
  metaClassificationForPendingAssistantRef: MutableRefObject<MetaCommentClassification | null>;
  recoveryAssistantSpokenAtSubstantiveSeqRef: MutableRefObject<number | null>;
  countsAsSubstantiveInterviewQuestionDelivery: (text: string) => boolean;
  stripControlTokens: (text: string) => string;
};
