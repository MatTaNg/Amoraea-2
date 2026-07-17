import { describe, expect, it } from '@jest/globals';

import { MOMENT_4_HANDOFF_NO_NAME_LEAD } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import {
  interviewHistoryContainsDeliveredScenarioCVignette,
  isPrematureStandaloneM4PersonalTransitionLine,
  shouldRedirectPrematureMoment4ToScenario2To3Handoff,
} from '@features/aria/prematureMoment4HandoffPlaybackGuard';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';

describe('prematureMoment4HandoffPlaybackGuard', () => {
  it('detects premature standalone M4 personal bridge without S3 boundary closure', () => {
    expect(isPrematureStandaloneM4PersonalTransitionLine('Now for something a bit more personal.')).toBe(
      true,
    );
    expect(isPrematureStandaloneM4PersonalTransitionLine('Now for the personal questions.')).toBe(true);
    expect(isPrematureStandaloneM4PersonalTransitionLine("Now it's time for the personal questions.")).toBe(
      true,
    );
    expect(
      isPrematureStandaloneM4PersonalTransitionLine(
        'Now I want to ask you about something a bit more personal.',
      ),
    ).toBe(true);
  });

  it('detects standalone two-questions-left cue before canonical M4 bundle', () => {
    expect(isPrematureStandaloneM4PersonalTransitionLine('There are only two questions left.')).toBe(
      true,
    );
    expect(
      isPrematureStandaloneM4PersonalTransitionLine(
        'There are only two questions left. Now I want to ask you about something a bit more personal.',
      ),
    ).toBe(true);
  });

  it('does not treat full S3→M4 handoff lead as premature standalone personal bridge', () => {
    expect(isPrematureStandaloneM4PersonalTransitionLine(MOMENT_4_HANDOFF_NO_NAME_LEAD)).toBe(false);
    const withReflection =
      "That's the end of the three described situations. Good work, Matt — you named leaving as on the table. Now I want to ask you about something a bit more personal.";
    expect(isPrematureStandaloneM4PersonalTransitionLine(withReflection)).toBe(false);
  });

  it('does not treat grudge question as premature personal bridge', () => {
    expect(isPrematureStandaloneM4PersonalTransitionLine(MOMENT_4_GRUDGE_QUESTION_TEXT)).toBe(false);
  });

  it('redirects premature M4 after scenario 2 when Sophie vignette not yet delivered', () => {
    const prematureM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: prematureM4,
        currentInterviewMoment: 3,
        messages: [
          { role: 'assistant', content: 'And if you were James, how would you repair?' },
          { role: 'user', content: "I'd let her define what support looks like." },
        ],
      }),
    ).toBe(true);
  });

  it('does not redirect truncated S3→M4 reflection about Daniel', () => {
    const truncated =
      "That's the end of the three situations. What came through was that you'd treat Daniel's exits as something";
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: truncated,
        currentInterviewMoment: 3,
      }),
    ).toBe(false);
  });

  it('does not redirect valid M4 handoff after Sophie vignette is in transcript', () => {
    const prematureM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: prematureM4,
        currentInterviewMoment: 3,
        messages: [{ role: 'assistant', content: SCENARIO_3_TEXT }],
      }),
    ).toBe(false);
  });

  it('redirects client M4 lead when vignette history is missing (speakTextSafe preDelivery gap)', () => {
    const clientM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: clientM4,
        currentInterviewMoment: 3,
        lastQuestionText: 'So what would the repair look like for Daniel?',
        lastSuccessfulTtsDeliveredPreview: 'So what would the repair look like for Daniel?',
      }),
    ).toBe(true);
  });

  it('does not redirect client M4 lead when situation_3 playback was already confirmed', () => {
    const clientM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: clientM4,
        currentInterviewMoment: 3,
        situation3CanonicalPlaybackConfirmed: true,
      }),
    ).toBe(false);
  });

  it('does not redirect client M4 lead when S3 repair probe was already delivered', () => {
    const clientM4 = `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${MOMENT_4_GRUDGE_QUESTION_TEXT}`;
    expect(
      shouldRedirectPrematureMoment4ToScenario2To3Handoff({
        text: clientM4,
        currentInterviewMoment: 3,
        s3RepairProbeDelivered: true,
      }),
    ).toBe(false);
  });

  it('detects delivered scenario C vignette in playback history', () => {
    expect(
      interviewHistoryContainsDeliveredScenarioCVignette({
        lastQuestionText: SCENARIO_3_TEXT,
      }),
    ).toBe(true);
  });
});
