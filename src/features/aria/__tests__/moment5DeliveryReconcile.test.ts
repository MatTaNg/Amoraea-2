import { describe, expect, it } from '@jest/globals';

import {
  moment5DeliveryRefsIndicateQuestionDelivered,
  reconcileMoment5DeliveryFromAssistantText,
  reconcileMoment5DeliveryFromTranscript,
  transcriptHasMoment5PrimaryConflictAnchor,
} from '@features/aria/moment5DeliveryReconcile';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';

describe('moment5DeliveryReconcile', () => {
  it('detects the scripted M5 conflict anchor in transcript', () => {
    expect(
      transcriptHasMoment5PrimaryConflictAnchor([
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      ]),
    ).toBe(true);
  });

  it('reconciles delivery refs from transcript when model delivered M5 without client inject', () => {
    const deps = {
      currentInterviewMomentRef: { current: 4 },
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: false },
    };
    const reconciled = reconcileMoment5DeliveryFromTranscript(deps, [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
    ]);
    expect(reconciled).toBe(true);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.moment5PrimaryAnchorDeliveredSessionRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
  });

  it('reconciles delivery refs from assistant text on post-claude persist', () => {
    const deps = {
      currentInterviewMomentRef: { current: 4 },
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: true },
    };
    expect(
      reconcileMoment5DeliveryFromAssistantText(deps, MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT),
    ).toBe(true);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
  });

  it('treats primary anchor session ref as delivered for probe gating', () => {
    expect(
      moment5DeliveryRefsIndicateQuestionDelivered({
        moment5QuestionDeliveredRef: { current: false },
        moment5PrimaryAnchorDeliveredSessionRef: { current: true },
      }),
    ).toBe(true);
  });
});
