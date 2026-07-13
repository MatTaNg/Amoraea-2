import type { MutableRefObject } from 'react';

import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';

export type InterviewAssistantMetaExemptionDeps = {
  substantiveInterviewQuestionDeliveredSeqRef: MutableRefObject<number>;
  metaCommentAckAwaitingSubstantiveBaselineSeqRef: MutableRefObject<number | null>;
  metaClassificationForPendingAssistantRef: MutableRefObject<MetaCommentClassification | null>;
  countsAsSubstantiveInterviewQuestionDelivery: (text: string) => boolean;
  stripControlTokens: (text: string) => string;
};
