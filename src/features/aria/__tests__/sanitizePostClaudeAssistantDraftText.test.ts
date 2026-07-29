import { describe, expect, it } from '@jest/globals';

import { sanitizePostClaudeAssistantDraftText } from '@features/aria/sanitizePostClaudeAssistantDraftText';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/scenarioAContemptProbeLogic';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('sanitizePostClaudeAssistantDraftText', () => {
  it('coerces invalid go-on model output during sanitize', () => {
    const deps = createMockPostClaudeDeps({
      elongatingProbeFiredRef: { current: false },
    });
    const user =
      'If I really liked Emma, I would assure her that this would not happen again and actually...';
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      trimmed: user,
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Makes sense. And actually — go on?',
      '',
      false,
    );

    expect(result.strippedText).toBe('Can you say more about that?');
    expect(result.assistantTurnIsElongatingProbeOnly).toBe(true);
    expect(deps.elongatingProbeFiredRef.current).toBe(true);
  });

  it('clears elongating probe copy when user turn suppressed elongating', () => {
    const deps = createMockPostClaudeDeps({
      elongatingProbeFiredRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      trimmed: 'Ryan should not have taken that call during their date with Emma.',
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Can you say more about that?',
      '',
      false,
    );

    expect(result.strippedText).toBe('');
    expect(result.assistantTurnIsElongatingProbeOnly).toBe(false);
    expect(deps.elongatingProbeFiredRef.current).toBe(true);
  });

  it('marks contempt probe asked when draft contains canonical S1 contempt question', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams();

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      '',
      false,
    );

    expect(result.assistantIssuedScenarioAContemptProbe).toBe(true);
    expect(deps.scenarioAContemptProbeAskedRef.current).toBe(true);
    expect(result.strippedText).toContain('Emma');
  });

  it('clears moment4 any-question flag when threshold follow-up is forced after model paraphrase', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      shouldForceMoment4ThresholdProbe: true,
      trimmed:
        'I had a fight with my friend. We talked it through and see eye to eye now.',
    });
    const modelParaphrase =
      'How do you decide when something like that is worth working through versus just walking away from?';

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      modelParaphrase,
      '',
      false,
    );

    expect(result.strippedText).toBe('');
    expect(result.assistantIssuedMoment4AnyQuestion).toBe(false);
    expect(result.assistantIssuedMoment4ThresholdProbe).toBe(false);
  });

  it('sets moment4 threshold probe asked when draft contains threshold question', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams();
    const thresholdDraft =
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      thresholdDraft,
      '',
      false,
    );

    expect(result.assistantIssuedMoment4ThresholdProbe).toBe(true);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
  });

  it('suppresses duplicate M4 threshold draft when client already injected threshold', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: true },
    });
    const params = createMockPostClaudeParams();
    const thresholdDraft =
      'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      thresholdDraft,
      '',
      false,
    );

    expect(result.strippedText).toBe('');
    expect(result.assistantIssuedMoment4ThresholdProbe).toBe(false);
    expect(result.assistantIssuedMoment4AnyQuestion).toBe(false);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
  });

  it('replaces thin modal follow-up with repair question when S1 contempt already satisfied', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      replyingToScenarioAQ1: true,
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Just say whatever comes to mind.',
      '',
      false,
    );

    expect(result.strippedText).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('normalizes truncated Got it. this with Emma? stream fragment to canonical S1 repair', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      replyingToScenarioAQ1: false,
      shouldForceScenarioAContemptProbe: false,
      messagesToUse: [
        { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
        { role: 'user', content: 'That line reads as contempt to me.' },
      ],
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Got it. this with Emma?',
      '',
      false,
    );

    expect(result.strippedText).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('replaces thin modal follow-up with repair when contempt satisfied at moment 2 (scenario still 1)', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      replyingToScenarioAQ1: false,
      shouldForceScenarioAContemptProbe: false,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        { role: 'user', content: 'Emma is frustrated when she says you made that very clear.' },
      ],
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Just say whatever comes to mind.',
      '',
      false,
    );

    expect(result.strippedText).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
    expect(result.shouldInjectScenarioARepairAfterContemptAnswer).toBe(true);
  });

  it('replaces Ryan coaching with repair after contempt user answer without Emma-line coverage flag', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: false,
      replyingToScenarioAQ1: false,
      shouldForceScenarioAContemptProbe: false,
      messagesToUse: [
        { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
        { role: 'user', content: 'She was frustrated and he was condescending.' },
      ],
      trimmed: 'She was frustrated and he was condescending.',
    });

    const result = sanitizePostClaudeAssistantDraftText(
      deps,
      params,
      'Just say whatever comes to mind — how would Ryan respond to her in that moment?',
      '',
      false,
    );

    expect(result.strippedText).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('strips incomplete Emma coaching and appends repair after Q1 contempt satisfied on first answer', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      replyingToScenarioAQ1: true,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        {
          role: 'user',
          content:
            "Emma is being condescending when she says you've made that very clear.",
        },
      ],
    });
    const draft =
      "There's a real read there — Ryan being on the call that long is the disruption, and Emma's closing line landing as condescending rather than just frustrated.\n\nHow do you think Emma actually";

    const result = sanitizePostClaudeAssistantDraftText(deps, params, draft, '', false);

    expect(result.strippedText).toContain(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
    expect(result.strippedText).not.toMatch(/how do you think emma actually/i);
    expect(result.shouldInjectScenarioARepairAfterContemptAnswer).toBe(true);
  });

  it('strips post-repair contempt re-ask when user already covered Emma line and answered repair', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        {
          role: 'user',
          content:
            "Emma is being condescending when she says, I know you've made that very clear.",
        },
        { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
        {
          role: 'user',
          content:
            "I'll make sure all calls go to voicemail during dates and set proper boundaries with my mom and commit to it.",
        },
      ],
    });
    const draft =
      'What did you make of Emma\'s closing line — "I know, you\'ve made that very clear"?';

    const result = sanitizePostClaudeAssistantDraftText(deps, params, draft, '', false);

    expect(result.strippedText).toMatch(/that's the end of this scenario|job hunting for four months/i);
    expect(result.strippedText).not.toMatch(/made that very clear|contempt/i);
  });

  it('strips post-repair Emma meant when she said contempt re-ask', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        {
          role: 'user',
          content:
            "Emma is being condescending when she says, I know you've made that very clear.",
        },
        { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
        {
          role: 'user',
          content:
            'I would commit to not taking calls during dates, let all calls go to voicemail, and commit to it.',
        },
      ],
    });
    const draft =
      'What do you think Emma meant when she said "you\'ve made that very clear"?';

    const result = sanitizePostClaudeAssistantDraftText(deps, params, draft, '', false);

    expect(result.strippedText).toMatch(/that's the end of this scenario|job hunting for four months/i);
    expect(result.strippedText).not.toMatch(/Emma meant when she said/i);
  });

  it('strips post-repair how does that land contempt re-ask from session logs', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        {
          role: 'user',
          content:
            "Ryan should not have taken a 25-minute call during their date. Emma is being condescending when she says you've made that very clear.",
        },
        { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
        {
          role: 'user',
          content:
            'I would apologize and make sure all calls go to voicemail during our date and set proper boundaries with my mom and commit to them.',
        },
      ],
    });
    const draft =
      'Reading that last line Emma says — "I know, you\'ve made that very clear" — how does that land for you? Is she just venting?';

    const result = sanitizePostClaudeAssistantDraftText(deps, params, draft, '', false);

    expect(result.strippedText).toMatch(/that's the end of this scenario|job hunting for four months/i);
    expect(result.strippedText).not.toMatch(/how does that land/i);
  });

  it('strips post-repair read-as-contempt paraphrase from session logs', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      scenarioARepairQuestionAskedRef: { current: true },
    });
    const params = createMockPostClaudeParams({
      specificEmmaLineAlreadyAddressed: true,
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?" },
        {
          role: 'user',
          content:
            "Ryan should not have taken a 20-minute call during their date. Emma said you've made that very clear. It sounded very condescending.",
        },
        { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
        {
          role: 'user',
          content:
            'I think I would apologize and make sure my phone is on silent during dates and set proper boundaries with my mother and commit to them.',
        },
      ],
    });
    const draft =
      'Got it — and that closing line from Emma, "you\'ve made that very clear" — did that read as contempt to you, or something else?';

    const result = sanitizePostClaudeAssistantDraftText(deps, params, draft, '', false);

    expect(result.strippedText).toMatch(/that's the end of this scenario|job hunting for four months/i);
    expect(result.strippedText).not.toMatch(/read as contempt/i);
  });
});
