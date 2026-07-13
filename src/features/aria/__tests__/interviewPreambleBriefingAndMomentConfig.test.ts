import { describe, expect, it } from '@jest/globals';

import {
  assistantTextIsPrematureMoment4HandoffDuringScenarioC,
  isFirstUserTurnAfterMoment5ConflictValidityClarification,
} from '@features/aria/interviewMomentScenarioConfig';
import { MOMENT_4_HANDOFF_NO_NAME_LEAD } from '@features/aria/interviewTransitionBundles';
import { buildFallbackIntroBriefingText, coerceOpeningNamePromptForTts, ensureCanonicalIntroBriefingForTts, insertPreambleBriefingIfMissing, introBriefingSpeechEndsWithReadinessQuestion, isIncompleteOpeningNamePrompt, isIntroBriefingReadinessOnlySentence } from '@features/aria/interviewPreambleBriefing';
import { WEB_INTERVIEW_OPENING_GREETING } from '@features/aria/utils/webInterviewGreetingAudio';
import { MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT } from '@features/aria/probeAndScoringUtils';

describe('interviewPreambleBriefing', () => {
  it('buildFallbackIntroBriefingText personalizes the greeting', () => {
    const text = buildFallbackIntroBriefingText('Alex');
    expect(text).toMatch(/Good to meet you, Alex/);
    expect(text).toMatch(/Are you ready\?/);
  });

  it('ensureCanonicalIntroBriefingForTts restores full briefing when readiness question is missing', () => {
    const partial =
      "Good to meet you, Matt. The way this works is I'll first give you three situations, and you just tell me what you'd do.";
    const out = ensureCanonicalIntroBriefingForTts(partial, 'Matt');
    expect(out).toMatch(/Are you ready\?$/);
    expect(out).toMatch(/Good to meet you, Matt/);
    expect(out.length).toBeGreaterThan(partial.length);
  });

  it('ensureCanonicalIntroBriefingForTts does not prepend greeting to streamed preamble body', () => {
    const preambleOnly =
      "The way this works is I'll first give you three situations, and you just tell me what you'd do in each situation. Then I'll give you two short personal questions.";
    const out = ensureCanonicalIntroBriefingForTts(preambleOnly, 'Matt');
    expect(out).not.toMatch(/^Good to meet you/i);
    expect(out).toMatch(/The way this works/);
    expect(out).not.toMatch(/Are you ready\?$/);
  });

  it('detects standalone readiness question sentences', () => {
    expect(isIntroBriefingReadinessOnlySentence('Are you ready?')).toBe(true);
    expect(introBriefingSpeechEndsWithReadinessQuestion('…comes to mind. Are you ready?')).toBe(true);
  });

  it('coerces truncated opening name prompt to canonical greeting', () => {
    expect(isIncompleteOpeningNamePrompt("Hi, I'm Amoraea. What can")).toBe(true);
    expect(coerceOpeningNamePromptForTts("Hi, I'm Amoraea. What can")).toBe(
      WEB_INTERVIEW_OPENING_GREETING,
    );
  });

  it('insertPreambleBriefingIfMissing adds briefing after name turn', () => {
    const briefing = buildFallbackIntroBriefingText('Alex');
    const out = insertPreambleBriefingIfMissing(
      [
        { role: 'assistant', content: 'Hi, what is your name?', scenarioNumber: 1 },
        { role: 'user', content: 'Alex' },
      ],
      briefing,
    );
    expect(out).toHaveLength(3);
    expect(out[2]?.role).toBe('assistant');
    expect(out[2]?.content).toMatch(/three situations/);
  });
});

describe('interviewMomentScenarioConfig', () => {
  it('detects premature Moment 4 handoff during Scenario C', () => {
    const text =
      "We've finished the three situations — now something more personal. Have you ever held a grudge against someone?";
    expect(assistantTextIsPrematureMoment4HandoffDuringScenarioC(text)).toBe(true);
  });

  it('detects session-log premature M4 handoff after scenario 2', () => {
    const text = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now.`;
    expect(assistantTextIsPrematureMoment4HandoffDuringScenarioC(text)).toBe(true);
  });

  it('does not flag valid S3→M4 boundary closure as premature during Scenario C', () => {
    const text =
      "That's the end of the three described situations. What I heard was that you're reading his silence as fear rather than avoidance. There are only two questions left. Now I want to ask you about something a bit more personal.\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    expect(assistantTextIsPrematureMoment4HandoffDuringScenarioC(text)).toBe(false);
  });

  it('does not flag valid S2→S3 handoff with Sophie vignette as premature M4', () => {
    const text =
      "That scenario is complete. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.";
    expect(assistantTextIsPrematureMoment4HandoffDuringScenarioC(text)).toBe(false);
  });

  it('isFirstUserTurnAfterMoment5ConflictValidityClarification is true with no user reply yet', () => {
    const messages = [
      { role: 'assistant', content: MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT },
      { role: 'assistant', content: 'Welcome back!', isWelcomeBack: true },
    ];
    expect(isFirstUserTurnAfterMoment5ConflictValidityClarification(messages)).toBe(true);
  });

  it('isFirstUserTurnAfterMoment5ConflictValidityClarification is false after user replies', () => {
    const messages = [
      { role: 'assistant', content: MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT },
      { role: 'user', content: 'It got tense but we worked through it.' },
    ];
    expect(isFirstUserTurnAfterMoment5ConflictValidityClarification(messages)).toBe(false);
  });
});
