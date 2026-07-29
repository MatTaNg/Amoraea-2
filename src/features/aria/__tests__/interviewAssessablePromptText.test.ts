import { describe, expect, it } from '@jest/globals';

import {
  assessablePromptQuestionBody,
  stripLeadingBriefAckFromAssessablePrompt,
} from '@features/aria/interviewAssessablePromptText';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE } from '@features/aria/skipAcceptedNextQuestionBridge';

describe('interviewAssessablePromptText', () => {
  it('strips leading brief acknowledgments from prompt text', () => {
    expect(
      stripLeadingBriefAckFromAssessablePrompt(
        'Got it. If you were Ryan, how would you repair this?',
      ),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
    expect(stripLeadingBriefAckFromAssessablePrompt('Makes sense. What do you think is going on here?')).toBe(
      'What do you think is going on here?',
    );
  });

  it('strips skip bridge and ack for assessable prompt body', () => {
    const spoken = `${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} Got it. If you were Ryan, how would you repair this?`;
    expect(assessablePromptQuestionBody(spoken)).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });
});
