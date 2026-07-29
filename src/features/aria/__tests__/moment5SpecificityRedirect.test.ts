import { describe, expect, it } from '@jest/globals';

import {
  looksLikeMoment5ResolutionFollowUpPrompt,
  moment5AssistantTurnAwaitingResolutionFollowUpAnswer,
  stripInterviewClosingBundledWithMoment5ResolutionFollowUp,
  transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp,
} from '../moment5SpecificityRedirect';
import { MOMENT_5_RESOLUTION_FOLLOWUP_TEXT } from '../moment5ProbeCopy';
import { evaluatePostClaudeNaturalLanguageClosingHandoff } from '../evaluatePostClaudeNaturalLanguageClosingHandoff';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '../probeAndScoringUtils';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  mockRef,
} from './postClaudeGateTestHelpers';

describe('moment5SpecificityRedirect resolution follow-up', () => {
  const sessionLogFollowUp =
    "When you stopped defending and owned that — did you two come up with anything specific to change going forward, or was naming it enough?";
  const sessionLogResolutionCompleteFollowUp =
    "Once you stopped defending and actually owned it — did the resolution feel complete to you, or was there still something unresolved after that conversation?";
  const sessionLogTensionResolutionFollowUp =
    "When she apologized — did things actually feel resolved between you two, or was it more just that the tension died down?";

  it('detects model paraphrase from session logs', () => {
    expect(looksLikeMoment5ResolutionFollowUpPrompt(MOMENT_5_RESOLUTION_FOLLOWUP_TEXT)).toBe(true);
    expect(looksLikeMoment5ResolutionFollowUpPrompt(sessionLogFollowUp)).toBe(true);
    expect(looksLikeMoment5ResolutionFollowUpPrompt(sessionLogResolutionCompleteFollowUp)).toBe(true);
    expect(looksLikeMoment5ResolutionFollowUpPrompt(sessionLogTensionResolutionFollowUp)).toBe(true);
    expect(
      looksLikeMoment5ResolutionFollowUpPrompt(
        'That makes a lot of sense. When you explained your reasons to her, how did she take it, and did things feel resolved between you two after that?',
      ),
    ).toBe(true);
  });

  it('strips bundled closing and keeps only the resolution follow-up question', () => {
    const bundled =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt. ' +
      sessionLogFollowUp;
    expect(stripInterviewClosingBundledWithMoment5ResolutionFollowUp(bundled)).toBe(sessionLogFollowUp);
  });

  it('strips bundled closing before tension-resolution follow-up from session logs', () => {
    const bundled =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt. ' +
      sessionLogTensionResolutionFollowUp;
    expect(stripInterviewClosingBundledWithMoment5ResolutionFollowUp(bundled)).toBe(
      sessionLogTensionResolutionFollowUp,
    );
  });

  it('transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp is true until user replies', () => {
    const transcript = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: 'We argued about work stress.' },
      { role: 'assistant', content: sessionLogFollowUp },
    ];
    expect(transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp(transcript)).toBe(true);
    expect(
      transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp([
        ...transcript,
        { role: 'user', content: 'We agreed to a weekly check-in.' },
      ]),
    ).toBe(false);
  });

  it('blocks M5 closing failsafe when tension-resolution follow-up is pending', () => {
    const conflictAnswer =
      'My roommate started a fight over dishes, it was ridiculous. She blew it out of proportion completely. I was being reasonable, and she needed to calm down. She eventually apologized.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(1),
      moment5AccountabilityProbeFiredRef: mockRef(false),
      isInterviewCompleteRef: mockRef(false),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: conflictAnswer, interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const bundledClosing =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt. ' +
      sessionLogTensionResolutionFollowUp;

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: sessionLogTensionResolutionFollowUp,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      sessionLogTensionResolutionFollowUp,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: sessionLogTensionResolutionFollowUp, scenarioNumber: 3 },
      ],
      {
        priorScenarioNum: 3,
        detectedScenario: null,
        emotionNaturalForward: false,
        emotionCompletedScenario: null,
        scenarioHandoffTransition: false,
        emotionNaturalS3ToM4: false,
        deferEmotionModal: false,
        deferBlocked: false,
        hasAfterModal: false,
      },
    );

    expect(moment5AssistantTurnAwaitingResolutionFollowUpAnswer({
      displayText: sessionLogTensionResolutionFollowUp,
      messages: [
        ...params.messagesToUse,
        { role: 'assistant', content: sessionLogTensionResolutionFollowUp },
      ],
    })).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(false);
    expect(bundledClosing).toContain(sessionLogTensionResolutionFollowUp);
  });

  it('blocks M5 closing failsafe when resolution follow-up is pending', () => {
    const conflictAnswer =
      'The cleanest one that comes to mind is a conflict with my partner last year where I had been distracted and checked out for a few weeks because of work stress. She brought it up and my first instinct was defensive. I took a breath and owned that. That conversation was really good once I stopped defending her.';
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: mockRef(5),
      moment5QuestionDeliveredRef: mockRef(true),
      moment5PrimaryAnchorDeliveredSessionRef: mockRef(true),
      moment5PostPromptUserTurnCountRef: mockRef(1),
      moment5AccountabilityProbeFiredRef: mockRef(false),
      isInterviewCompleteRef: mockRef(false),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
        { role: 'user', content: conflictAnswer, interviewMoment: 5 },
      ],
      textToParallelStream: { full: '', spokenStarted: true, closingSpoken: false },
    });
    const bundledClosing =
      'Good work getting through all of this, Matt. What landed for me was how you name what happened between you and what you own in it. Thank you for being so open with me, Matt. ' +
      sessionLogFollowUp;

    const result = evaluatePostClaudeNaturalLanguageClosingHandoff(
      deps,
      params,
      {
        strippedText: bundledClosing,
        parallelStreamingPlaybackUsed: true,
        rawApiHadInterviewComplete: false,
      },
      sessionLogFollowUp,
      [
        ...params.messagesToUse,
        { role: 'assistant', content: sessionLogFollowUp, scenarioNumber: 3 },
      ],
      {
        priorScenarioNum: 3,
        detectedScenario: null,
        emotionNaturalForward: false,
        emotionCompletedScenario: null,
        scenarioHandoffTransition: false,
        emotionNaturalS3ToM4: false,
        deferEmotionModal: false,
        deferBlocked: false,
        hasAfterModal: false,
      },
    );

    expect(moment5AssistantTurnAwaitingResolutionFollowUpAnswer({
      displayText: sessionLogFollowUp,
      messages: [
        ...params.messagesToUse,
        { role: 'assistant', content: sessionLogFollowUp },
      ],
    })).toBe(true);
    expect(result.shouldFailsafeComplete).toBe(false);
  });
});
