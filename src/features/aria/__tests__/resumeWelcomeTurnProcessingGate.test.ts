import { describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import {
  isResumeWelcomeFlowBlockingTurnProcessing,
  isStaleInterviewUserTurn,
} from '@features/aria/resumeWelcomeTurnProcessingGate';
describe('resumeWelcomeTurnProcessingGate', () => {
  it('blocks turn processing while resume loading is active', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: true },
        webResumeWelcomeTapPendingRef: { current: false },
        resumeOfferWelcomeTtsRef: { current: false },
        resumeRepeatChoicePendingRef: { current: false },
      }),
    ).toBe(true);
  });

  it('blocks turn processing while web welcome tap is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: false },
        webResumeWelcomeTapPendingRef: { current: true },
        resumeOfferWelcomeTtsRef: { current: true },
        resumeRepeatChoicePendingRef: { current: false },
      }),
    ).toBe(true);
  });

  it('detects stale user-turn epochs after resume invalidation', () => {
    const epochRef = { current: 2 };
    expect(isStaleInterviewUserTurn(1, epochRef)).toBe(true);
    expect(isStaleInterviewUserTurn(2, epochRef)).toBe(false);
  });

  it('does not block fresh web turns when resume welcome TTS is not offered', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing({
        resumeLoadingFlowActiveRef: { current: false },
        webResumeWelcomeTapPendingRef: { current: false },
        resumeOfferWelcomeTtsRef: { current: false },
        resumeRepeatChoicePendingRef: { current: false },
        webResumeWelcomeTapHandledRef: { current: false },
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
          webResumeWelcomeTapPendingRef: { current: false },
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

  it('still blocks short procedural replies while repeat-choice is pending', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          webResumeWelcomeTapPendingRef: { current: false },
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
    ).toBe(true);
  });

  it('allows explicit repeat requests while repeat-choice is pending after resume welcome', () => {
    expect(
      isResumeWelcomeFlowBlockingTurnProcessing(
        {
          resumeLoadingFlowActiveRef: { current: false },
          webResumeWelcomeTapPendingRef: { current: false },
          resumeOfferWelcomeTtsRef: { current: false },
          resumeRepeatChoicePendingRef: { current: true },
        },
        {
          substantiveTranscript: {
            text: 'Repeat what you said.',
            wordCount: 4,
            lastQuestionText: 'How would you repair this as Ryan?',
          },
        },
      ),
    ).toBe(false);
  });
});
