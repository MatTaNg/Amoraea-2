import {
  gateTabRestoreReplayTextForEmotionModal,
} from '@features/aria/tabRestoreEmotionModalReplayGate';

describe('gateTabRestoreReplayTextForEmotionModal', () => {
  const S1_TO_S2_HANDOFF =
    "That's a wrap on that one. Nice work — You pointed toward working together directly.\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' That evening James leads with questions about the salary, the start date, and the commute. At one point Sarah tears up. James says 'hey don't cry, this is a good thing'. The next day Sarah tells James she never feels appreciated. James is blindsided, he showed up, he celebrated, he asked questions. A fight starts.\n\nWhat do you think is going on here?";

  it('trims post-modal vignette and stashes afterModal when emotion modal not yet shown', () => {
    const pendingEmotionModalTransitionRef = { current: null as null | {
      completedScenario: 1 | 2 | 3;
      afterModal: string;
      transitionText: string;
      priorScenario: 1 | 2 | 3 | null;
    } };
    const emotionModalShownForScenarioRef = { current: new Set<1 | 2 | 3>() };

    const trimmed = gateTabRestoreReplayTextForEmotionModal(S1_TO_S2_HANDOFF, {
      pendingEmotionModalTransitionRef,
      emotionModalShownForScenarioRef,
    });

    expect(trimmed).toContain("That's a wrap on that one");
    expect(trimmed).not.toContain('Sarah has been job hunting');
    expect(pendingEmotionModalTransitionRef.current?.completedScenario).toBe(1);
    expect(pendingEmotionModalTransitionRef.current?.afterModal).toContain('Sarah has been job hunting');
  });

  it('does not trim when emotion modal already shown for completed scenario', () => {
    const pendingEmotionModalTransitionRef = { current: null };
    const emotionModalShownForScenarioRef = { current: new Set<1 | 2 | 3>([1]) };

    const trimmed = gateTabRestoreReplayTextForEmotionModal(S1_TO_S2_HANDOFF, {
      pendingEmotionModalTransitionRef,
      emotionModalShownForScenarioRef,
    });

    expect(trimmed).toBe(S1_TO_S2_HANDOFF);
    expect(pendingEmotionModalTransitionRef.current).toBeNull();
  });
});
