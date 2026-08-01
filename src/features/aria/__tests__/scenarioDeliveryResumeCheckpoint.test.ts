import {
  hydrateShowScenarioCardPlaybackConfirmedFromStorage,
  lastQuestionTextIndicatesScenarioOpeningDelivered,
  maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback,
  maybePersistScenarioOpeningDeliveredAfterQuestionDelivered,
  resumeScenarioOpeningWasHeardBeforeExit,
  resolveScenarioResumeIntroBodyForReplay,
  transcriptHasScenarioOpeningQuestionDelivered,
} from '@features/aria/scenarioDeliveryResumeCheckpoint';
import {
  SHOW_SCENARIO_1_FULL_EXACT,
  SHOW_SCENARIO_1_OPENING_EXACT,
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_FULL_EXACT,
  SHOW_SCENARIO_2_OPENING_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_FULL_EXACT,
  SHOW_SCENARIO_3_OPENING_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { buildScenarioResumeReplaySpokenBody, SCENARIO_RESUME_REPLAY_TRANSITION } from '@features/aria/interviewScenarioVignetteCopy';
import { buildCanonicalShowScenarioCardTtsBody } from '@features/aria/showScenarioCardCanonicalTts';

jest.mock('@utilities/storage/InterviewStorage', () => ({
  loadInterviewFromStorage: jest.fn(async () => null),
  mergeInterviewStoragePayload: jest.fn((prior: unknown, next: unknown) => ({ ...(prior as object), ...(next as object) })),
  saveInterviewToStorage: jest.fn(async () => undefined),
}));

import { saveInterviewToStorage } from '@utilities/storage/InterviewStorage';

describe('scenarioDeliveryResumeCheckpoint', () => {
  describe('transcriptHasScenarioOpeningQuestionDelivered', () => {
    it('returns true when opening playback was persisted without transcript anchor', () => {
      expect(transcriptHasScenarioOpeningQuestionDelivered([], 1, [1])).toBe(true);
    });

    it('does not treat transcript-only opening text as delivered without playback confirmation', () => {
      const msgs = [{ role: 'assistant', content: SHOW_SCENARIO_1_OPENING_EXACT }];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(false);
    });

    it('treats committed Q1 after vignette as delivered when playback was not persisted (S1)', () => {
      const msgs = [
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
        { role: 'assistant', content: SHOW_SCENARIO_1_OPENING_EXACT, scenarioNumber: 1 },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(true);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
        }),
      ).toBeNull();
    });

    it('does not treat full scenario transcript as delivered when closed mid-TTS', () => {
      const msgs = [{ role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT }];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 2)).toBe(false);
    });

    it('returns true once the user has answered mid-scenario even without persisted playback', () => {
      const msgs = [
        { role: 'assistant', content: SHOW_SCENARIO_3_FULL_EXACT },
        { role: 'user', content: 'Daniel was overwhelmed and Sophie felt abandoned.', scenarioNumber: 3 },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 3)).toBe(true);
    });

    it('returns false when only vignette is in transcript', () => {
      const msgs = [{ role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT }];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(false);
    });

    it('does not treat readiness "Yes" before scenario vignette as opening delivered', () => {
      const msgs = [
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
          scenarioNumber: 1,
        },
        { role: 'user', content: 'Matt', scenarioNumber: 1 },
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
          scenarioNumber: 1,
        },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(false);
    });

    it('returns true when user answered after the scenario vignette anchor', () => {
      const msgs = [
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
        { role: 'user', content: 'Emma feels dismissed because Ryan took a long call.', scenarioNumber: 1 },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(true);
    });

    it('does not treat readiness "Yes" after a partial stream intro anchor as opening delivered', () => {
      const msgs = [
        {
          role: 'assistant',
          content:
            "Emma and Ryan are at dinner when Ryan takes a call from his mother and steps away.",
          scenarioNumber: 1,
        },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(false);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });

    it('returns true when user answered mid-scenario without vignette anchor in transcript', () => {
      const msgs = [
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
        },
        { role: 'user', content: 'Matt', scenarioNumber: 1 },
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
        },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
        {
          role: 'user',
          content: 'Emma feels dismissed because Ryan prioritized his mother during dinner.',
          scenarioNumber: 1,
        },
      ];
      expect(transcriptHasScenarioOpeningQuestionDelivered(msgs, 1)).toBe(true);
    });
  });

  describe('resolveScenarioResumeIntroBodyForReplay', () => {
    it('returns null when opening playback was confirmed (question-only replay)', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_1_FULL_EXACT }],
          persistedOpeningDeliveredFor: [1],
        }),
      ).toBeNull();
    });

    it('replays full scenario when vignette is in transcript but opening was not heard (mid-TTS close)', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_1_FULL_EXACT }],
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });

    it('includes transition, vignette, and opening question for S1 replay', () => {
      const replay = buildScenarioResumeReplaySpokenBody(1);
      expect(replay).toContain(SCENARIO_RESUME_REPLAY_TRANSITION);
      expect(replay).toContain(SHOW_SCENARIO_1_VIGNETTE_EXACT);
      expect(replay).toContain(SHOW_SCENARIO_1_OPENING_EXACT);
    });

    it('replays full S2 when vignette is in transcript but opening was not delivered', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 2,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT }],
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(2));
    });

    it('replays full S3 when vignette is in transcript but opening was not delivered', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 3,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_3_FULL_EXACT }],
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(3));
    });

    it('returns null when saved lastQuestionText is the Scenario 3 opening question and user already participated', () => {
      const msgs = [
        { role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT },
        {
          role: 'user',
          content: 'Daniel was overwhelmed and Sophie felt abandoned.',
          scenarioNumber: 3,
        },
      ];
      expect(
        lastQuestionTextIndicatesScenarioOpeningDelivered(SHOW_SCENARIO_3_OPENING_EXACT, 3),
      ).toBe(true);
      expect(
        transcriptHasScenarioOpeningQuestionDelivered(
          msgs,
          3,
          null,
          SHOW_SCENARIO_3_OPENING_EXACT,
        ),
      ).toBe(true);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 3,
          transcriptMessages: msgs,
          lastQuestionText: SHOW_SCENARIO_3_OPENING_EXACT,
        }),
      ).toBeNull();
    });

    it('replays full S3 when lastQuestionText is opening but vignette is in transcript and user has not answered', () => {
      expect(
        transcriptHasScenarioOpeningQuestionDelivered(
          [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
          3,
          null,
          SHOW_SCENARIO_3_OPENING_EXACT,
        ),
      ).toBe(false);
      expect(
        resumeScenarioOpeningWasHeardBeforeExit({
          scenario: 3,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
          lastQuestionText: SHOW_SCENARIO_3_OPENING_EXACT,
          navigationAwayAudioInterrupt: 'tts',
        }),
      ).toBe(false);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 3,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
          lastQuestionText: SHOW_SCENARIO_3_OPENING_EXACT,
          navigationAwayAudioInterrupt: 'tts',
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(3));
    });

    it('returns null for question-only replay when opening was saved and user closed idle after prompt', () => {
      const msgs = [{ role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 }];
      expect(
        resumeScenarioOpeningWasHeardBeforeExit({
          scenario: 1,
          transcriptMessages: msgs,
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
          navigationAwayAudioInterrupt: null,
        }),
      ).toBe(true);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
          navigationAwayAudioInterrupt: null,
        }),
      ).toBeNull();
    });

    it('returns null for question-only replay when user closed while mic was on (recording interrupt)', () => {
      const msgs = [{ role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 }];
      expect(
        resumeScenarioOpeningWasHeardBeforeExit({
          scenario: 1,
          transcriptMessages: msgs,
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
          navigationAwayAudioInterrupt: 'recording',
        }),
      ).toBe(true);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
          navigationAwayAudioInterrupt: 'recording',
        }),
      ).toBeNull();
    });

    it('returns null when canonical opening playback was persisted and vignette is in transcript', () => {
      expect(
        transcriptHasScenarioOpeningQuestionDelivered(
          [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
          3,
          [3],
          null,
        ),
      ).toBe(true);
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 3,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT }],
          persistedOpeningDeliveredFor: [3],
        }),
      ).toBeNull();
    });

    it('replays full scenario when only vignette is in transcript (mid-delivery close)', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 2,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_2_VIGNETTE_EXACT }],
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(2));
    });

    it('replays full scenario when readiness assent exists and only vignette is in transcript (S1)', () => {
      const msgs = [
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
        },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
        { role: 'assistant', content: SHOW_SCENARIO_1_VIGNETTE_EXACT, scenarioNumber: 1 },
      ];
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });

    it('replays full scenario when vignette is not in transcript yet', () => {
      const msgs = [
        {
          role: 'assistant',
          content:
            "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
        },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
      ];
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });

    it('returns full scenario intro when nothing was heard yet', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: [],
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });

    it('returns null when user is mid-scenario without vignette anchor (question-only replay)', () => {
      const msgs = [
        { role: 'user', content: 'Matt', scenarioNumber: 1 },
        { role: 'user', content: 'Yes', scenarioNumber: 1 },
        {
          role: 'user',
          content: 'Emma feels dismissed because Ryan prioritized his mother during dinner.',
          scenarioNumber: 1,
        },
      ];
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: msgs,
        }),
      ).toBeNull();
    });

    it('returns full intro when forceFullScenarioRestart is set', () => {
      expect(
        resolveScenarioResumeIntroBodyForReplay({
          scenario: 1,
          transcriptMessages: [{ role: 'assistant', content: SHOW_SCENARIO_1_OPENING_EXACT }],
          persistedOpeningDeliveredFor: [1],
          forceFullScenarioRestart: true,
        }),
      ).toBe(buildScenarioResumeReplaySpokenBody(1));
    });
  });

  describe('hydrateShowScenarioCardPlaybackConfirmedFromStorage', () => {
    it('maps persisted scenarios to playback-confirmed kinds', () => {
      expect(hydrateShowScenarioCardPlaybackConfirmedFromStorage([1, 3])).toEqual({
        situation_1: true,
        situation_3: true,
      });
    });
  });

  describe('maybePersistScenarioOpeningDeliveredAfterQuestionDelivered', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('persists lastQuestionText and opening delivered when question_delivered is the S1 opening', async () => {
      await maybePersistScenarioOpeningDeliveredAfterQuestionDelivered({
        userId: 'user-1',
        deliveredQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        currentScenario: 1,
      });

      expect(saveInterviewToStorage).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          scenarioOpeningDeliveredFor: [1],
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        }),
      );
    });

    it('does not persist for non-opening probe questions', async () => {
      await maybePersistScenarioOpeningDeliveredAfterQuestionDelivered({
        userId: 'user-1',
        deliveredQuestionText: 'If you were Ryan, how would you repair this?',
        currentScenario: 1,
      });

      expect(saveInterviewToStorage).not.toHaveBeenCalled();
    });
  });

  describe('maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('persists scenario 1 opening after confirmed canonical playback', async () => {
      await maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback({
        userId: 'user-1',
        text: buildCanonicalShowScenarioCardTtsBody('situation_1'),
        audioPlaybackTruncated: false,
        durationMatch: true,
        lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        currentScenario: 1,
      });

      expect(saveInterviewToStorage).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          scenarioOpeningDeliveredFor: [1],
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        }),
      );
    });

    it('persists when delivery includes a spoken transition prefix before the vignette', async () => {
      await maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback({
        userId: 'user-1',
        text: `Here's the first situation:\n\n${SHOW_SCENARIO_1_FULL_EXACT}`,
        audioPlaybackTruncated: false,
        durationMatch: true,
        currentScenario: 1,
      });

      expect(saveInterviewToStorage).toHaveBeenCalled();
    });

    it('does not persist when playback was truncated', () => {
      maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback({
        userId: 'user-1',
        text: SHOW_SCENARIO_1_FULL_EXACT,
        audioPlaybackTruncated: true,
        durationMatch: true,
      });

      expect(saveInterviewToStorage).not.toHaveBeenCalled();
    });

    it('persists when playback completed without premature cutoff even if duration_match is false', async () => {
      await maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback({
        userId: 'user-1',
        text: SHOW_SCENARIO_1_FULL_EXACT,
        audioPlaybackTruncated: false,
        durationMatch: false,
        actualDurationMs: 18781,
        expectedDurationMs: 16958,
        lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        currentScenario: 1,
      });

      expect(saveInterviewToStorage).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          scenarioOpeningDeliveredFor: [1],
          lastQuestionText: SHOW_SCENARIO_1_OPENING_EXACT,
        }),
      );
    });

    it('does not persist when playback ended prematurely (truncated tail)', () => {
      maybePersistScenarioOpeningDeliveredAfterSpeakTextSafePlayback({
        userId: 'user-1',
        text: SHOW_SCENARIO_1_FULL_EXACT,
        audioPlaybackTruncated: false,
        durationMatch: false,
        actualDurationMs: 3000,
        expectedDurationMs: 16958,
      });

      expect(saveInterviewToStorage).not.toHaveBeenCalled();
    });
  });
});
