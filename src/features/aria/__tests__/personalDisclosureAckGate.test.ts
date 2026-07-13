import {
  isPersonalMomentInterviewTurn,
  isStandalonePersonalDisclosureAcknowledgment,
  resolveScenarioFollowUpAfterSuppressedResponse,
  stripStandalonePersonalDisclosureAckOutsidePersonalMoments,
} from '../personalDisclosureAckGate';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '../probeAndScoringUtils';

describe('personalDisclosureAckGate', () => {
  it('detects standalone personal disclosure acknowledgments with optional name', () => {
    expect(isStandalonePersonalDisclosureAcknowledgment('Thank you for sharing that, Matt.')).toBe(true);
    expect(isStandalonePersonalDisclosureAcknowledgment('Thanks for sharing that.')).toBe(true);
    expect(isStandalonePersonalDisclosureAcknowledgment('Thank you for being so open with me, Matt.')).toBe(
      true,
    );
    expect(
      isStandalonePersonalDisclosureAcknowledgment(
        'What about when Emma says "you\'ve made that very clear" — what do you make of that?',
      ),
    ).toBe(false);
  });

  it('strips standalone personal ack outside personal moments only', () => {
    expect(
      stripStandalonePersonalDisclosureAckOutsidePersonalMoments(
        'Thank you for sharing that, Matt.',
        1,
      ),
    ).toBe('');
    expect(
      stripStandalonePersonalDisclosureAckOutsidePersonalMoments(
        'Thank you for sharing that, Matt.',
        4,
      ),
    ).toBe('Thank you for sharing that, Matt.');
  });

  it('isPersonalMomentInterviewTurn is true only for moments 4 and 5', () => {
    expect(isPersonalMomentInterviewTurn(4)).toBe(true);
    expect(isPersonalMomentInterviewTurn(5)).toBe(true);
    expect(isPersonalMomentInterviewTurn(3)).toBe(false);
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse returns S1 contempt probe when due', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 1,
        shouldForceScenarioAContemptProbe: true,
        assistantIssuedScenarioAContemptProbe: false,
        shouldInjectScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: false,
        scenarioARepairQuestionAsked: false,
      }),
    ).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse returns S1 repair after contempt', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        assistantIssuedScenarioAContemptProbe: true,
        shouldInjectScenarioARepairAfterContemptAnswer: true,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        transcriptMessages: [
          { role: 'user', content: 'q1' },
          { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
          { role: 'user', content: 'condescending' },
        ],
      }),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse delivers repair after phantom repair in transcript', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        assistantIssuedScenarioAContemptProbe: true,
        shouldInjectScenarioARepairAfterContemptAnswer: true,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        transcriptMessages: [
          { role: 'user', content: 'q1' },
          { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
          { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
          { role: 'user', content: 'condescending' },
        ],
      }),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse does not skip ahead to repair before contempt answer', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 1,
        shouldForceScenarioAContemptProbe: false,
        assistantIssuedScenarioAContemptProbe: true,
        shouldInjectScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        transcriptMessages: [
          { role: 'user', content: 'q1' },
          { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
        ],
      }),
    ).toBeNull();
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse returns repair when contempt satisfied without probe at moment 2', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 2,
        currentScenario: 1,
        shouldForceScenarioAContemptProbe: false,
        assistantIssuedScenarioAContemptProbe: false,
        shouldInjectScenarioARepairAfterContemptAnswer: true,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        transcriptMessages: [
          { role: 'user', content: 'Emma is frustrated when she says you made that very clear.' },
        ],
      }),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse returns null for personal moments', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 4,
        shouldForceScenarioAContemptProbe: true,
        assistantIssuedScenarioAContemptProbe: false,
        shouldInjectScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: false,
        scenarioARepairQuestionAsked: false,
      }),
    ).toBeNull();
  });

  it('resolveScenarioFollowUpAfterSuppressedResponse skips contempt when already in transcript', () => {
    expect(
      resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: 1,
        shouldForceScenarioAContemptProbe: true,
        assistantIssuedScenarioAContemptProbe: false,
        shouldInjectScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBFullAppreciationProbe: false,
        assistantIssuedScenarioBFullProbe: false,
        needsScenarioBJamesDifferentlyInsert: false,
        scenarioAContemptProbeAsked: false,
        scenarioARepairQuestionAsked: false,
        transcriptMessages: [
          { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
        ],
      }),
    ).toBeNull();
  });
});
