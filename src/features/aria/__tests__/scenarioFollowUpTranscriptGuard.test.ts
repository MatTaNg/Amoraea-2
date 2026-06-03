import {
  scenarioFollowUpAlreadyInTranscript,
  scenarioOneFollowUpFlagsFromTranscript,
  shouldDeliverScenarioFollowUpQuestion,
  transcriptContainsScenarioAContemptProbe,
  transcriptContainsScenarioARepairQuestion,
} from '../scenarioFollowUpTranscriptGuard';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '../probeAndScoringUtils';

describe('scenarioFollowUpTranscriptGuard', () => {
  const contemptAssistant = {
    role: 'assistant' as const,
    content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  };
  const repairAssistant = {
    role: 'assistant' as const,
    content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  };

  it('detects Scenario A contempt probe in transcript', () => {
    const msgs = [{ role: 'user', content: 'Ryan was wrong.' }, contemptAssistant];
    expect(transcriptContainsScenarioAContemptProbe(msgs)).toBe(true);
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).contemptProbeAsked).toBe(true);
  });

  it('blocks duplicate contempt probe delivery when already in transcript', () => {
    const msgs = [{ role: 'user', content: 'x' }, contemptAssistant];
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
    ).toBe(false);
    expect(
      scenarioFollowUpAlreadyInTranscript(msgs, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
    ).toBe(true);
  });

  it('allows contempt probe when transcript has no prior assistant follow-up', () => {
    const msgs = [{ role: 'user', content: 'Ryan mishandled it.' }];
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
    ).toBe(true);
  });

  it('detects repair question and blocks duplicate repair delivery', () => {
    const msgs = [{ role: 'user', content: 'x' }, contemptAssistant, repairAssistant];
    expect(transcriptContainsScenarioARepairQuestion(msgs)).toBe(true);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(false);
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(true);
  });

  it('ignores welcome-back and score-card assistant turns', () => {
    const msgs = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY, isWelcomeBack: true },
    ];
    expect(transcriptContainsScenarioAContemptProbe(msgs)).toBe(false);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
    ).toBe(true);
  });

  it('matches contempt probe when wrapped with acknowledgment prefix', () => {
    const wrapped = `That makes sense. ${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}`;
    const msgs = [{ role: 'assistant', content: wrapped }];
    expect(transcriptContainsScenarioAContemptProbe(msgs)).toBe(true);
    expect(shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)).toBe(
      false,
    );
  });
});
