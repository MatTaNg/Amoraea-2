import { describe, expect, it } from '@jest/globals';

import {
  isResumeWelcomeFlowBlockingTurnProcessing,
  isStaleInterviewUserTurn,
} from '@features/aria/resumeWelcomeTurnProcessingGate';
describe('resumeWelcomeTurnProcessingGate', () => {
  it('blocks turn processing while resume loading is active', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: true },
        resumeOfferWelcomeTtsRef: { current: false },
        resumeRepeatChoicePendingRef: { current: false },
      }),
    ).toBe(true);
  });

  it('does not block solely because resumeOfferWelcomeTtsRef is set', () => {
    // Welcome TTS offer is tracked for orchestration; turn blocking uses loading / repeat-choice / playback lock.
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: false },
        resumeOfferWelcomeTtsRef: { current: true },
        resumeRepeatChoicePendingRef: { current: false },
      }),
    ).toBe(false);
  });

  it('detects stale user-turn epochs after resume invalidation', () => {
    const epochRef = { current: 2 };
    expect(isStaleInterviewUserTurn(1, epochRef)).toBe(true);
    expect(isStaleInterviewUserTurn(2, epochRef)).toBe(false);
  });

  it('does not block fresh turns when resume welcome is idle', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: false },
        resumeOfferWelcomeTtsRef: { current: false },
        resumeRepeatChoicePendingRef: { current: false },
      }),
    ).toBe(false);
  });

  it('does not block substantive answers while repeat-choice is pending after resume welcome', () => {
    const sessionAnswer =
      "Yeah, I may give it that he needs some help in knowing some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's really avoided.";
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: sessionAnswer,
            wordCount: 34,
            lastQuestionText: "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?",
          },
        },
      ),
    ).toBe(false);
  });

  it('does not block short continue/repeat intents while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'yes',
            wordCount: 1,
            lastQuestionText: null,
          },
        },
      ),
    ).toBe(false);
  });

  it('does not block Whisper-mangled repeat requests while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'He what you said',
            wordCount: 4,
            lastQuestionText:
              "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.",
          },
        },
      ),
    ).toBe(false);
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'Pee at what you said.',
            wordCount: 5,
            lastQuestionText:
              "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.",
          },
        },
      ),
    ).toBe(false);
  });

  it('still blocks short non-choice replies while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'um',
            wordCount: 1,
            lastQuestionText: null,
          },
        },
      ),
    ).toBe(true);
  });

  it('does not block identity / off-topic asks while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'Are you an alien?',
            wordCount: 4,
            lastQuestionText: 'Got it. If you were Ryan, how would you repair this?',
          },
        },
      ),
    ).toBe(false);
  });

  it('does not block "I don\'t understand the question" while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: "I don't understand the question.",
            wordCount: 5,
            lastQuestionText:
              "What about when Emma says 'you've made that very clear' — what do you make of that?",
          },
        },
      ),
    ).toBe(false);
  });

  it('does not block "I don\'t know" while repeat-choice is pending (inability → skip offer)', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: "I don't know",
            wordCount: 3,
            lastQuestionText:
              "What about when Emma says 'you've made that very clear' — what do you make of that?",
          },
        },
      ),
    ).toBe(false);
  });

  it('does not block mid-length S3 answers while repeat-choice is pending without token overlap', () => {
    const sessionAnswer = 'Daniel is very avoidant and he had to leave to regulate his emotions.';
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: sessionAnswer,
            wordCount: 13,
            lastQuestionText: 'Got it. How do you think this situation could be repaired?',
          },
        },
      ),
    ).toBe(false);
  });
});
