import { describe, expect, it } from '@jest/globals';

import { mergeInterviewTurnOrchestratorDecisions } from '@features/aria/mergeInterviewTurnOrchestratorDecisions';
import { resolvePendingPersonalMomentProbe } from '@features/aria/resolvePendingPersonalMomentProbe';
import { validatePostClaudeAssistantDraft } from '@features/aria/validatePostClaudeAssistantDraft';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';

function heuristic(overrides: Partial<InterviewTurnOrchestratorDecision> = {}): InterviewTurnOrchestratorDecision {
  return {
    source: 'heuristic_v1',
    userIntent: 'substantive_answer',
    activeQuestionPreview: 'preview',
    satisfiedProbeIds: [],
    pendingProbeId: null,
    activeConstructEngaged: true,
    action: { kind: 'delegate_claude' },
    reason: 'heuristic',
    ...overrides,
  };
}

describe('mergeInterviewTurnOrchestratorDecisions', () => {
  it('returns heuristic when LLM disabled', () => {
    const h = heuristic();
    const merged = mergeInterviewTurnOrchestratorDecisions({
      heuristic: h,
      llm: null,
      preferLlm: false,
    });
    expect(merged.resolution).toBe('heuristic');
    expect(merged.decision.source).toBe('heuristic_v1');
  });

  it('prefers LLM when live and parsed', () => {
    const h = heuristic({ action: { kind: 'speak_canonical', probeId: 's1_contempt' } });
    const l = heuristic({
      source: 'llm_v1',
      action: { kind: 'skip_probe_already_satisfied', probeId: 's1_contempt' },
    });
    const merged = mergeInterviewTurnOrchestratorDecisions({
      heuristic: h,
      llm: l,
      preferLlm: true,
    });
    expect(merged.resolution).toBe('llm_live_overrides');
    expect(merged.decision.action.kind).toBe('skip_probe_already_satisfied');
  });
});

describe('resolvePendingPersonalMomentProbe', () => {
  it('returns m4_commitment_orientation when grudge answered substantively', () => {
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: MOMENT_4_GRUDGE_QUESTION_TEXT,
        lastQuestionText: MOMENT_4_GRUDGE_QUESTION_TEXT,
        userText:
          'My ex and I had a terrible falling out after she lied about money for two years and I cut her off.',
        transcriptTurnCount: 4,
      },
      messages: [
        { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
        {
          role: 'user',
          content:
            'My ex and I had a terrible falling out after she lied about money for two years and I cut her off.',
          interviewMoment: 4,
        },
      ],
      lastAssistantContent: MOMENT_4_GRUDGE_QUESTION_TEXT,
    });
    expect(pending).toBe('m4_commitment_orientation');
  });

  it('returns m_support after a substantive keep-investing answer', () => {
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
        lastQuestionText: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
        userText:
          'We kept going because we had built so much together and I still believed we could repair things if we both showed up.',
        transcriptTurnCount: 6,
      },
      messages: [
        { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
        { role: 'user', content: 'My close friend betrayed my confidence and we have not spoken in a year.', interviewMoment: 4 },
        { role: 'assistant', content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT, interviewMoment: 4 },
        {
          role: 'user',
          content:
            'We kept going because we had built so much together and I still believed we could repair things if we both showed up.',
          interviewMoment: 4,
        },
      ],
      lastAssistantContent: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
    });
    expect(pending).toBe('m_support');
    expect(pending).not.toBe('m4_commitment_threshold');
  });

  it('returns need-recognition after an assessable answer to the no-situation hypothetical', () => {
    const hypothetical = MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT;
    const answer =
      'I would make them tea, sit nearby, and let them talk for as long as they wanted.';
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: hypothetical,
        lastQuestionText: hypothetical,
        userText: answer,
        transcriptTurnCount: 8,
      },
      messages: [
        { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
        { role: 'user', content: "I don't have a situation", interviewMoment: 4 },
        { role: 'assistant', content: hypothetical, interviewMoment: 4 },
        { role: 'user', content: answer, interviewMoment: 4 },
      ],
      lastAssistantContent: hypothetical,
    });
    expect(pending).toBe('m_support_need_recognition');
  });

  it('skips the need-recognition probe when the support answer already says they would ask', () => {
    const answer =
      'I think I would try to talk to them and maybe give them a hug and ask them how they feel and ask if they needed support from me and that support would look like listening and being present with them asking what happened and really just being with their emotions without trying to change it.';
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: MOMENT_SUPPORT_QUESTION_TEXT,
        lastQuestionText: MOMENT_SUPPORT_QUESTION_TEXT,
        userText: answer,
        transcriptTurnCount: 8,
      },
      messages: [
        { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
        { role: 'user', content: answer, interviewMoment: 4 },
      ],
      lastAssistantContent: MOMENT_SUPPORT_QUESTION_TEXT,
    });
    expect(pending).toBe('m5_conflict');
  });

  it('returns m5_conflict after short need-recognition answer "I asked her"', () => {
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
        lastQuestionText: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
        userText: 'I asked her.',
        transcriptTurnCount: 10,
      },
      messages: [
        { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
        {
          role: 'user',
          content: "I told her it'll be okay and stop feeling how she's feeling and feel a different way",
          interviewMoment: 4,
        },
        { role: 'assistant', content: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT, interviewMoment: 4 },
        { role: 'user', content: 'I asked her.', interviewMoment: 4 },
      ],
      lastAssistantContent: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
    });
    expect(pending).toBe('m5_conflict');
  });
});

describe('validatePostClaudeAssistantDraft', () => {
  const baseDraft: SanitizePostClaudeAssistantDraftResult = {
    strippedText: 'Thanks for sharing.',
    shouldInjectScenarioARepairAfterContemptAnswer: false,
    scenarioHandoffAssistantTurn: false,
    recentAsstForAck: [],
    assistantIssuedMoment4ThresholdProbe: false,
    assistantIssuedMoment4AnyQuestion: false,
    assistantIssuedScenarioAContemptProbe: false,
    assistantIssuedScenarioARepairQuestion: false,
    assistantIssuedScenarioBFullProbe: false,
    assistantIssuedScenarioBJamesDifferently: false,
    assistantIssuedScenarioBRepairAsJames: false,
    assistantTurnIsElongatingProbeOnly: false,
  };

  it('flags missing S1 contempt when params force it', () => {
    const result = validatePostClaudeAssistantDraft({
      strippedText: 'Thanks for sharing.',
      params: {
        shouldForceScenarioAContemptProbe: true,
        shouldForceScenarioBJamesRepairProbe: false,
        shouldForceScenarioCSophiePerspectiveProbe: false,
        shouldForceMoment4OrientationProbe: false,
        shouldForceMoment4ThresholdProbe: false,
        suppressForcedConstructProbesForMetaFrustration: false,
      } as never,
      draft: baseDraft,
    });
    expect(result.requiresForcedCanonicalProbeIds).toContain('s1_contempt');
    expect(result.skipScenarioForcedProbes).toBe(true);
  });
});
