import { describe, expect, it } from '@jest/globals';

import {
  computeMoment5InterviewCloseGate,
  computeMoment5ResolutionFollowUpGateState,
} from '@features/aria/interviewProgressSync';
import {
  isLenientInterviewCloseAfterClosingSpeech,
  isMoment5ReadyForInterviewClose,
  looksLikeInterviewClosingAssistantMessage,
  moment5AnswerIncludesResolutionOutcome,
} from '@features/aria/elongatingProbe';
import {
  evaluateMoment5AccountabilityProbe,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  moment5AnswerHasExplicitSelfAccountability,
} from '@features/aria/moment5AccountabilityProbe';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, MOMENT_5_RESOLUTION_FOLLOWUP_TEXT } from '@features/aria/moment5ProbeCopy';
import { looksLikeMoment5ResolutionFollowUpPrompt } from '@features/aria/moment5SpecificityRedirect';
import { evaluatePostClaudeNaturalLanguageClosingHandoff } from '@features/aria/evaluatePostClaudeNaturalLanguageClosingHandoff';
import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  mockRef,
} from './postClaudeGateTestHelpers';

const CONFLICT_ANSWER =
  "Yeah, my friend Devanshu, he said I was a bad coach, I didn't like that, and so I got into an argument with him, I raised my voice, I was kind of pissed at him. So we talked it out, I understand where he's coming from, I don't agree with it, I think it was too immature, but it was facilitated, we listened to each other, and we're okay now, we're on good terms.";

const LOOKING_BACK =
  'Looking back on that argument — do you think there was anything you could have owned or done differently on your side?';

const CLOSING =
  'Good work getting through all of this. What I heard was that you see repair as staying with it until you can talk it through. Thank you for being so open with me, Matt.';

const baseEmotionDiag = {
  priorScenarioNum: 3 as const,
  detectedScenario: null,
  emotionNaturalForward: false,
  emotionCompletedScenario: null,
  scenarioHandoffTransition: false,
  emotionNaturalS3ToM4: false,
  deferEmotionModal: false,
  deferBlocked: false,
  hasAfterModal: false,
};

describe('M5 close gate session repro (bee620b3 closing without preparing_results)', () => {
  it('allows single-turn close when probe would skip for ownership + resolution (session answer)', () => {
    expect(moment5AnswerIncludesResolutionOutcome(CONFLICT_ANSWER)).toBe(true);
    const probe = evaluateMoment5AccountabilityProbe(CONFLICT_ANSWER);
    expect(probe.shouldProbe).toBe(false);
    expect(probe.selfReference.self_reference_type).toBe('specific_ownership');
    expect(moment5AnswerHasExplicitSelfAccountability(CONFLICT_ANSWER)).toBe(true);
    expect(
      isMoment5ReadyForInterviewClose({
        currentInterviewMoment: 5,
        moment5QuestionDelivered: true,
        postM5UserTurns: 1,
        accountabilityProbeFired: false,
        hasMoment5PrimaryAnchorInTranscript: true,
        moment5CombinedUserText: CONFLICT_ANSWER,
        accountabilityProbeStillRequired: false,
        resolutionFollowUpStillRequired: false,
      }),
    ).toBe(true);
  });

  it('does not treat model looking-back as scripted accountability or resolution follow-up', () => {
    expect(looksLikeMoment5AccountabilityProbeAssistantPrompt(LOOKING_BACK)).toBe(false);
    expect(looksLikeMoment5ResolutionFollowUpPrompt(LOOKING_BACK)).toBe(false);
  });

  it('allows close gate after conflict answer + looking-back + closing with postM5UserTurns=1', () => {
    const msgs = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: CONFLICT_ANSWER, interviewMoment: 5 },
      { role: 'assistant', content: LOOKING_BACK },
      { role: 'assistant', content: CLOSING },
    ];
    const gate = computeMoment5InterviewCloseGate(msgs, {
      moment5QuestionDelivered: true,
      moment5PrimaryAnchorSession: true,
      postM5UserTurnsRef: 1,
      accountabilityProbeFired: false,
      currentInterviewMoment: 5,
    });
    expect(gate).toMatchObject({
      postM5UserTurns: 1,
      accountabilityProbeStillRequired: false,
      resolutionFollowUpStillRequired: false,
      moment5CloseAllowed: true,
    });
  });

  it('recovers M5 combined text when user rows omit interviewMoment tagging', () => {
    const msgs = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: CONFLICT_ANSWER },
      { role: 'assistant', content: CLOSING },
    ];
    const gate = computeMoment5InterviewCloseGate(msgs, {
      moment5QuestionDelivered: true,
      moment5PrimaryAnchorSession: true,
      postM5UserTurnsRef: 1,
      accountabilityProbeFired: false,
      currentInterviewMoment: 5,
    });
    expect(gate.moment5CombinedForCloseGate).toContain('raised my voice');
    expect(gate.resolutionFollowUpStillRequired).toBe(false);
    expect(gate.moment5CloseAllowed).toBe(true);
  });

  it('failsafe-completes when closing looks final after ownership answer (session shape)', () => {
    expect(looksLikeInterviewClosingAssistantMessage(CLOSING)).toBe(true);
    const msgs = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: CONFLICT_ANSWER, interviewMoment: 5 },
      { role: 'assistant', content: LOOKING_BACK },
    ];
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(1),
      moment5AccountabilityProbeFiredRef: mockRef(false),
      isInterviewCompleteRef: mockRef(false),
      personalHandoffInjectedRef: mockRef(true),
      parallelStreamingTtsRef: mockRef({
        ...createInitialParallelStreamingTtsState(),
        spokenCompleteText: LOOKING_BACK,
      }),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: msgs,
      textToParallelStream: { full: CLOSING, spokenStarted: true, closingSpoken: false },
      participantFirstNameForSpoken: 'Matt',
    });
    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: CLOSING,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      CLOSING,
      [...msgs, { role: 'assistant', content: CLOSING, scenarioNumber: 3 }],
      baseEmotionDiag,
    );
    expect(result.closingLooksFinal).toBe(true);
    expect(result.closeGateForFailsafe.moment5CloseAllowed).toBe(true);
    expect(
      isLenientInterviewCloseAfterClosingSpeech({
        closingText: CLOSING,
        hasMoment5PrimaryAnchorInTranscript: true,
        postM5UserTurns: 1,
        personalHandoffInjected: true,
        currentInterviewMoment: 5,
        moment5CloseAllowed: result.closeGateForFailsafe.moment5CloseAllowed,
      }),
    ).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(true);
  });

  it('blocks close after resolution follow-up TTS until the user answers', () => {
    const mainAnswer =
      'We argued about money. I snapped and said something harsh. It came out worse than I meant.';
    const msgs = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: mainAnswer, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
    ];
    const gate = computeMoment5InterviewCloseGate(msgs, {
      moment5QuestionDelivered: true,
      moment5PrimaryAnchorSession: true,
      postM5UserTurnsRef: 1,
      accountabilityProbeFired: false,
      currentInterviewMoment: 5,
      moment5ResolutionDelivered: true,
    });
    expect(gate.resolutionFollowUpDelivered).toBe(true);
    expect(gate.resolutionFollowUpAwaitingAnswer).toBe(true);
    expect(gate.resolutionFollowUpStillRequired).toBe(true);
    expect(gate.moment5CloseAllowed).toBe(false);
  });

  it('allows close only after resolution follow-up exchange completes', () => {
    const mainAnswer =
      'We argued about money. I snapped and said something harsh. It came out worse than I meant.';
    const resolutionAnswer = 'We talked the next day and apologized to each other.';
    const msgs = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: mainAnswer, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
      { role: 'user', content: resolutionAnswer, interviewMoment: 5 },
    ];
    const gate = computeMoment5InterviewCloseGate(msgs, {
      moment5QuestionDelivered: true,
      moment5PrimaryAnchorSession: true,
      postM5UserTurnsRef: 2,
      accountabilityProbeFired: false,
      currentInterviewMoment: 5,
      moment5ResolutionDelivered: true,
    });
    expect(gate.resolutionFollowUpAwaitingAnswer).toBe(false);
    expect(gate.resolutionFollowUpStillRequired).toBe(false);
    expect(gate.moment5CloseAllowed).toBe(true);
  });

  it('computeMoment5ResolutionFollowUpGateState allows close without follow-up when answer already includes resolution', () => {
    const state = computeMoment5ResolutionFollowUpGateState({
      transcriptSlice: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: CONFLICT_ANSWER },
      ],
      moment5CombinedForCloseGate: CONFLICT_ANSWER,
      hasMoment5PrimaryAnchorInTranscript: true,
      moment5ResolutionDelivered: false,
    });
    expect(state.resolutionFollowUpStillRequired).toBe(false);
  });
});
