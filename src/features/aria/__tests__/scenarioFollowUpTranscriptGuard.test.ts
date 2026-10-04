import {
  scenarioFollowUpAlreadyInTranscript,
  scenarioAMinimumEngagementForHandoff,
  scenarioOneFollowUpFlagsFromTranscript,
  shouldDeliverScenarioFollowUpQuestion,
  isScenarioARepairFollowUpCompleteInTranscript,
  shouldStillSpeakSituation2AfterIncompleteS1Engagement,
  stripPrematureScenarioABoundaryFromDraft,
  transcriptContainsScenarioAContemptProbe,
  transcriptContainsScenarioARepairQuestion,
  transcriptContainsScenarioCRepairQuestion,
  userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe,
} from '../scenarioFollowUpTranscriptGuard';
import { shouldAllowScenarioARepairAfterContemptAnswer } from '../scenarioARepairQuestionHelpers';
import { SCORE_REQUEST_DECLINE_LINE } from '../interviewPromptInstructions';
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

  it('does not allow retired S1 repair delivery when repair text is in transcript but user has not answered yet', () => {
    const msgs = [
      contemptAssistant,
      { role: 'user', content: "It's very condescending. She's very frustrated at Ryan." },
      repairAssistant,
    ];
    expect(transcriptContainsScenarioARepairQuestion(msgs)).toBe(true);
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(false);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(true);
    expect(
      shouldAllowScenarioARepairAfterContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: true,
        replyingToScenarioAQ1: false,
        specificEmmaLineAlreadyAddressed: false,
        shouldForceScenarioAContemptProbe: false,
        messagesToUse: msgs,
      }),
    ).toBe(false);
  });

  it('still speaks Situation 2 when the close already started after a short repair answer', () => {
    const msgs = [
      contemptAssistant,
      repairAssistant,
      { role: 'user' as const, content: "Honey, honey, please try to understand, it's my mother." },
    ];
    const closingStream =
      "Good work — that's the end of this scenario. Here's the next situation. Sarah and James have been together for two years.";
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(false);
    expect(
      shouldStillSpeakSituation2AfterIncompleteS1Engagement({
        messages: msgs,
        fullStream: closingStream,
        repairQuestionAsked: true,
      }),
    ).toBe(true);
    expect(
      shouldStillSpeakSituation2AfterIncompleteS1Engagement({
        messages: msgs,
        fullStream: closingStream,
        repairQuestionAsked: false,
      }),
    ).toBe(false);
    expect(
      shouldStillSpeakSituation2AfterIncompleteS1Engagement({
        messages: msgs,
        fullStream: 'What else do you notice?',
        repairQuestionAsked: true,
      }),
    ).toBe(false);
  });

  it('does not speak the Ryan repair question again after a cut-off answer following the take-your-time ack', () => {
    const msgs = [
      contemptAssistant,
      repairAssistant,
      { role: 'assistant', content: 'Take your time — just say whatever comes to mind.' },
      { role: 'user', content: "Honey, please understand, it's my moth-" },
    ];
    expect(isScenarioARepairFollowUpCompleteInTranscript(msgs)).toBe(true);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(false);
  });

  it('does not speak the Ryan repair question again after an in-character answer', () => {
    const msgs = [
      contemptAssistant,
      repairAssistant,
      {
        role: 'assistant',
        content: "I wasn't able to understand that — you may have gotten cut off. Can you try again?",
      },
      { role: 'user', content: "Honey, please understand, it's my mother." },
    ];
    expect(isScenarioARepairFollowUpCompleteInTranscript(msgs)).toBe(true);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(false);
  });

  it('detects repair question and blocks duplicate repair delivery after user answered', () => {
    const msgs = [
      { role: 'user', content: 'x' },
      contemptAssistant,
      repairAssistant,
      { role: 'user', content: 'I would apologize.' },
    ];
    expect(transcriptContainsScenarioARepairQuestion(msgs)).toBe(true);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(false);
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(true);
  });

  it('treats repair as complete when score-decline meta sits between repair ask and user answer', () => {
    const msgs = [
      contemptAssistant,
      repairAssistant,
      { role: 'assistant', content: SCORE_REQUEST_DECLINE_LINE },
      {
        role: 'user',
        content:
          "If I were Ryan, I would say, oh I see you're upset, let's talk about what we both need so the situation doesn't repeat itself.",
      },
    ];
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(true);
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });

  it('treats repair before contempt probe as phantom — repair still deliverable after contempt answer', () => {
    const msgs = [
      { role: 'user', content: 'q1 answer' },
      repairAssistant,
      contemptAssistant,
      { role: 'user', content: 'It seems condescending.' },
    ];
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(false);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(true);
  });

  it('treats repair glued into contempt compound turn as phantom — repair still deliverable after contempt answer', () => {
    const compound = {
      role: 'assistant' as const,
      content: `${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}\n\n${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`,
    };
    const msgs = [
      { role: 'user', content: 'q1 answer with quote' },
      compound,
      { role: 'user', content: 'Probably some contempt, frustration.' },
    ];
    expect(scenarioOneFollowUpFlagsFromTranscript(msgs).repairQuestionAsked).toBe(false);
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY),
    ).toBe(true);
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

  it('detects Scenario C repair Q2 in transcript', () => {
    const msgs = [
      {
        role: 'assistant' as const,
        content: 'How do you think this situation could be repaired?',
      },
    ];
    expect(transcriptContainsScenarioCRepairQuestion(msgs)).toBe(true);
  });

  it('blocks duplicate Scenario C repair delivery when already in transcript', () => {
    const msgs = [
      {
        role: 'assistant' as const,
        content: 'How do you think this situation could be repaired?',
      },
      { role: 'user', content: 'Daniel should apologize to Sophie.' },
    ];
    expect(
      shouldDeliverScenarioFollowUpQuestion(msgs, 'How do you think this situation could be repaired?'),
    ).toBe(false);
  });

  it('scenarioAMinimumEngagementForHandoff is false after Q1 only', () => {
    const msgs = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      { role: 'user', content: 'They need clearer boundaries about phone use on dates.' },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(false);
  });

  it('scenarioAMinimumEngagementForHandoff stays false when Q1 only covers the Emma line', () => {
    const msgs = [
      {
        role: 'assistant',
        content: "What's going on between these two?",
        scenarioNumber: 1,
        interviewMoment: 1,
      },
      {
        role: 'user',
        content:
          "Ryan should not have taken that call during their date. Emma is being condescending when she says you've made that very clear.",
        scenarioNumber: 1,
        interviewMoment: 1,
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(false);
  });

  it('scenarioAMinimumEngagementForHandoff is true after a long answer to the Ryan repair question', () => {
    const msgs = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'That sounds dismissive.' },
      { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
      {
        role: 'user',
        content:
          'Ryan, it might be a little difficult for Ryan because it sounds like this is something that he has on autopilot, kind of trained to do, always answer your family call. Changes take time and he would need to understand where Emma is coming from.',
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });

  it('scenarioAMinimumEngagementForHandoff stays false after generic sit-down-and-talk advice', () => {
    const msgs = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'I would suggest they sit down and talk.' },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(false);
  });

  it('scenarioAMinimumEngagementForHandoff stays false after a contempt answer that does not repair', () => {
    const msgs = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'That sounds dismissive and contemptuous to me.' },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(false);
  });

  it('scenarioAMinimumEngagementForHandoff is true after repair answer even when repair context finder misses', () => {
    const msgs = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'That sounds dismissive and contemptuous to me.' },
      { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
      {
        role: 'user',
        content:
          "I would set boundaries so all calls go to voicemail during dates and commit to that with Emma.",
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });

  it('scenarioAMinimumEngagementForHandoff is true after Ryan sit-down / boundaries repair answer', () => {
    const msgs = [
      {
        role: 'assistant',
        content: "What about when Emma says 'you've made that very clear' — what do you make of that?",
      },
      {
        role: 'user',
        content: "She definitely feels like she's in a subordinate position to his mother.",
      },
      { role: 'assistant', content: 'Got it. If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "If I were Ryan, which I'm not, I would have a sit down with both my mother and with Emma. For my mother, I would be setting boundaries, letting her know that she doesn't have instant constant access to me. As for Emma, I would truly assert in how she feels, not only what's happening right in the now, I would go deeper into her emotional state and her triggering in her past to find out why this is so triggering for her.",
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });

  it('scenarioAMinimumEngagementForHandoff accepts If I\'m Ryan / I assure repair phrasing', () => {
    const msgs = [
      { role: 'assistant', content: 'Got it. If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          "If I'm Ryan and I really liked Emma, I assure her that this would not happen again and actually follow through.",
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });

  it('stripPrematureScenarioABoundaryFromDraft keeps contempt probe when bundled with wrap', () => {
    const bundled = `${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}\n\nThat's a wrap on that one. Nice work — You focused on putting concrete limits on calls during dates.`;
    expect(stripPrematureScenarioABoundaryFromDraft(bundled)).toBe(
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );
  });

  it('userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe when contempt missing from transcript', () => {
    const msgs = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      { role: 'user', content: 'They need clearer boundaries about phone use on dates.' },
      {
        role: 'user',
        content:
          'That feels like a snide comment, but we should work through it together as a couple.',
      },
    ];
    expect(
      userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe({
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        lastDeliveredQuestionText: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        messagesToUse: msgs,
      }),
    ).toBe(true);
  });

  it('shouldAllowScenarioARepairAfterContemptAnswer is true while the Ryan repair question is active', () => {
    const msgs = [
      { role: 'user', content: 'q1' },
      { role: 'user', content: 'contempt answer' },
    ];
    expect(
      shouldAllowScenarioARepairAfterContemptAnswer({
        currentScenario: 1,
        currentMoment: 1,
        scenarioAContemptProbeAsked: true,
        scenarioARepairQuestionAsked: false,
        replyingToScenarioAQ1: false,
        specificEmmaLineAlreadyAddressed: false,
        shouldForceScenarioAContemptProbe: false,
        messagesToUse: msgs,
        lastDeliveredQuestionText: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      }),
    ).toBe(true);
  });

  it('scenarioAMinimumEngagementForHandoff after stream-only contempt when answer includes repair substance', () => {
    const msgs = [
      { role: 'assistant', content: 'What do you think is going on between these two?' },
      { role: 'user', content: 'They need clearer boundaries about phone use on dates.' },
      {
        role: 'user',
        content:
          "I would talk it through with her together and set a clear agreement about what is okay on dates instead of snide comments.",
      },
    ];
    expect(scenarioAMinimumEngagementForHandoff(msgs)).toBe(true);
  });
});
