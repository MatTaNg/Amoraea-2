import { describe, expect, it } from '@jest/globals';

import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { IRRELEVANT_ANSWER_RETRY_LINE } from '@features/aria/interviewAnswerRelevance';
import {
  isAssistantBubbleForTranscript,
  isResumeOrScenarioReplayUiPrompt,
  MOMENT_4_PERSONAL_LABEL,
  runRestoreReferenceCardFromTranscriptIfNeeded,
  syncReferenceCardStateFromAssistantMessages,
  trySplitFictionalScenarioIntroLongDelivery,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import {
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { isScenarioModalFollowUpProbe } from '@features/aria/interviewScenarioModalPrompt';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  SCENARIO_1_VIGNETTE,
  SCENARIO_2_TEXT,
  SCENARIO_3_TEXT,
} from '@features/aria/interviewScenarioVignetteCopy';
import { SHOW_SCENARIO_1_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { buildScenario1VignetteIntroBundle } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, SCENARIO_B_JAMES_REPAIR_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';

describe('interviewReferenceCardResumeHelpers', () => {
  it('isResumeOrScenarioReplayUiPrompt detects scenario replay offers', () => {
    expect(
      isResumeOrScenarioReplayUiPrompt('Would it help to hear the scenario again?'),
    ).toBe(true);
    expect(isResumeOrScenarioReplayUiPrompt('How would you repair this as Ryan?')).toBe(false);
  });

  it('does not split locked Scenario 1 intro bundle (vignette + opening in one TTS)', () => {
    const bundle = buildScenario1VignetteIntroBundle(SCENARIO_1_VIGNETTE, SCENARIO_1_OPENING);
    expect(trySplitFictionalScenarioIntroLongDelivery(bundle)).toBeNull();
    expect(bundle).toContain(SCENARIO_1_OPENING);
  });

  it('resume Show scenario footer keeps Sophie probe instead of Situation 3 opening', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SCENARIO_3_TEXT },
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
    ]);
    expect(synced.scenario?.label).toBe('Situation 3');
    expect(synced.prompt).toBe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
  });

  it('resume Show scenario footer keeps Situation 1 contempt probe', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT },
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    ]);
    expect(synced.scenario?.label).toBe('Situation 1');
    expect(synced.prompt).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('resume Show scenario footer keeps Situation 2 James differently probe', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: SCENARIO_2_TEXT },
      { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
    ]);
    expect(synced.scenario?.label).toBe('Situation 2');
    expect(synced.prompt).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('resume Situation 2 mid-scenario uses active scenario when S1 boundary lines are in transcript', () => {
    const jamesDifferently =
      'That makes a lot of sense. What do you think James could have done differently to help Sarah feel appreciated?';
    const synced = syncReferenceCardStateFromAssistantMessages(
      [
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT },
        { role: 'assistant', content: SCENARIO_2_TEXT },
        { role: 'assistant', content: 'What do you think is going on here?' },
        { role: 'assistant', content: jamesDifferently },
      ],
      {
        fullTranscript: [
          { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
          { role: 'assistant', content: SCENARIO_2_TEXT, scenarioNumber: 2 },
          { role: 'user', content: 'Sarah wanted to feel celebrated emotionally.', scenarioNumber: 2 },
          { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
          { role: 'user', content: 'James focused on logistics instead of feelings.', scenarioNumber: 2 },
          { role: 'assistant', content: jamesDifferently, scenarioNumber: 2 },
        ],
        activeScenario: 2,
        lastQuestionText: jamesDifferently,
      },
    );
    expect(synced.scenario?.label).toBe('Situation 2');
    expect(synced.prompt).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('resume Situation 2 mid-scenario without vignette anchor still shows Situation 2 card', () => {
    const jamesDifferently = SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
    const synced = syncReferenceCardStateFromAssistantMessages(
      [
        { role: 'assistant', content: 'What do you think is going on here?' },
        { role: 'assistant', content: jamesDifferently },
      ],
      {
        fullTranscript: [
          { role: 'user', content: 'Sarah wanted emotional validation.', scenarioNumber: 2 },
          { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
          { role: 'user', content: 'James focused on logistics.', scenarioNumber: 2 },
          { role: 'assistant', content: jamesDifferently, scenarioNumber: 2 },
        ],
        activeScenario: 2,
        lastQuestionText: jamesDifferently,
      },
    );
    expect(synced.scenario?.label).toBe('Situation 2');
    expect(synced.prompt).toBe(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('syncs Personal reflection when user turn is tagged interviewMoment 4', () => {
    const synced = syncReferenceCardStateFromAssistantMessages(
      [{ role: 'assistant', content: SCENARIO_2_TEXT }],
      {
        fullTranscript: [
          { role: 'assistant', content: SCENARIO_2_TEXT },
          { role: 'user', content: 'My coworker and I had a falling out.', interviewMoment: 4 },
        ],
      },
    );
    expect(synced.scenario?.label).toBe(MOMENT_4_PERSONAL_LABEL);
    expect(synced.prompt).toBe(MOMENT_4_GRUDGE_QUESTION_TEXT);
  });

  it('syncs commitment-threshold card when threshold assistant turn is in full transcript', () => {
    const synced = syncReferenceCardStateFromAssistantMessages(
      [{ role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT }],
      {
        fullTranscript: [
          { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
          { role: 'user', content: 'My friend betrayed my trust years ago.', interviewMoment: 4 },
          { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT },
        ],
      },
    );
    expect(synced.scenario?.label).toBe(MOMENT_4_PERSONAL_LABEL);
    expect(synced.scenario?.text).toBe(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY);
    expect(synced.prompt).toBe(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY);
  });

  it('syncs Moment 5 card when M5 question follows threshold (not grudge fallback)', () => {
    const synced = syncReferenceCardStateFromAssistantMessages(
      [
        { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
        { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT },
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      ],
      {
        fullTranscript: [
          { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
          { role: 'user', content: 'My friend betrayed my trust years ago.', interviewMoment: 4 },
          { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT },
          { role: 'user', content: 'I try to work through things when trust is broken.', interviewMoment: 4 },
          { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        ],
      },
    );
    expect(synced.scenario?.text).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim());
  });

  it('preserves committed Situation 2 repair prompt when trailing assistant is cut-off retry', () => {
    const committedScenarioRef = {
      current: { label: 'Situation 2', text: SCENARIO_2_TEXT },
    };
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();
    runRestoreReferenceCardFromTranscriptIfNeeded({
      messages: [
        { role: 'assistant', content: SCENARIO_2_TEXT },
        { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
        { role: 'user', content: 'He could have listened first.' },
        { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
        { role: 'user', content: "I'll ask Sarah if she'd like to be celebrated." },
        { role: 'assistant', content: IRRELEVANT_ANSWER_RETRY_LINE },
      ],
      committedScenarioRef,
      isAssistantBubbleForTranscript: (m) => m.role === 'assistant',
      setInterviewUiPhase: jest.fn(),
      setReferenceCardPrompt,
      setReferenceCardScenario,
    });
    expect(setReferenceCardPrompt).not.toHaveBeenCalled();
    expect(setReferenceCardScenario).not.toHaveBeenCalled();
  });

  it('does not downgrade committed threshold card to grudge after message refresh', () => {
    const committedScenarioRef = {
      current: {
        label: MOMENT_4_PERSONAL_LABEL,
        text: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
      },
    };
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();
    runRestoreReferenceCardFromTranscriptIfNeeded({
      messages: [
        { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
        { role: 'user', content: 'My friend betrayed my trust years ago.', interviewMoment: 4 },
        { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT },
      ],
      committedScenarioRef,
      isAssistantBubbleForTranscript: (m) => m.role === 'assistant',
      setInterviewUiPhase: jest.fn(),
      setReferenceCardPrompt,
      setReferenceCardScenario,
    });
    expect(committedScenarioRef.current?.text).toBe(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY);
    expect(setReferenceCardScenario).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: MOMENT_4_GRUDGE_QUESTION_TEXT }),
    );
  });

  it('does not downgrade Personal reflection card to Situation 2 on message refresh', () => {
    const committedScenarioRef = {
      current: { label: MOMENT_4_PERSONAL_LABEL, text: MOMENT_4_GRUDGE_QUESTION_TEXT },
    };
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();
    runRestoreReferenceCardFromTranscriptIfNeeded({
      messages: [
        { role: 'assistant', content: SCENARIO_2_TEXT },
        { role: 'user', content: 'My coworker and I had a falling out.', interviewMoment: 4 },
      ],
      committedScenarioRef,
      isAssistantBubbleForTranscript: (m) => m.role === 'assistant',
      setInterviewUiPhase: jest.fn(),
      setReferenceCardPrompt,
      setReferenceCardScenario,
    });
    expect(setReferenceCardScenario).not.toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Situation 2' }),
    );
    expect(committedScenarioRef.current?.label).toBe(MOMENT_4_PERSONAL_LABEL);
  });

  it('syncs Situation 3 card when mid-S3 progress exists without vignette anchor', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const synced = syncReferenceCardStateFromAssistantMessages(
      [
        { role: 'assistant', content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
        { role: 'assistant', content: s3Q1 },
      ],
      {
        fullTranscript: [
          { role: 'assistant', content: SCENARIO_2_TEXT },
          { role: 'assistant', content: s3Q1, interviewMoment: 3 },
          { role: 'user', content: 'Daniel felt genuinely at home.', interviewMoment: 3 },
        ],
      },
    );
    expect(synced.scenario?.label).toBe('Situation 3');
    expect(synced.prompt).toMatch(/what do you make of that\?/i);
  });

  it('does not downgrade committed Situation 3 card to Situation 2 on message refresh', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const committedScenarioRef = {
      current: { label: 'Situation 3', text: SCENARIO_3_TEXT },
    };
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();
    runRestoreReferenceCardFromTranscriptIfNeeded({
      messages: [
        { role: 'assistant', content: SCENARIO_2_TEXT },
        { role: 'assistant', content: s3Q1, interviewMoment: 3 },
        { role: 'user', content: 'Daniel felt genuinely at home.', interviewMoment: 3 },
        { role: 'assistant', content: 'Makes sense. Just say whatever comes to mind.', interviewMoment: 3 },
      ],
      committedScenarioRef,
      isAssistantBubbleForTranscript: (m) => m.role === 'assistant',
      setInterviewUiPhase: jest.fn(),
      setReferenceCardPrompt,
      setReferenceCardScenario,
    });
    expect(setReferenceCardScenario).not.toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Situation 2' }),
    );
    expect(committedScenarioRef.current?.label).toBe('Situation 3');
  });
});

describe('isScenarioModalFollowUpProbe scripted construct carve-out', () => {
  it('does not treat Sophie perspective as a thin follow-up', () => {
    expect(isScenarioModalFollowUpProbe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)).toBe(false);
  });
});
