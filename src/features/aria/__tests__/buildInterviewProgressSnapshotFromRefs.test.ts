import { describe, expect, it, jest } from '@jest/globals';

import {
  buildInterviewProgressSnapshotFromRefs,
  installInterviewAuthSignedOutSaveListener,
} from '@features/aria/buildInterviewProgressSnapshotFromRefs';

describe('buildInterviewProgressSnapshotFromRefs', () => {
  it('tolerates missing refs and returns empty snapshot defaults', () => {
    expect(buildInterviewProgressSnapshotFromRefs({})).toEqual({
      messages: [],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: 1,
      resumeActiveScenario: null,
      lastQuestionText: null,
    });
  });

  it('reads latest ref values when refs are present', () => {
    const snapshot = buildInterviewProgressSnapshotFromRefs({
      currentMessagesRef: { current: [{ role: 'user', content: 'hello' }] },
      scoredScenariosRef: { current: new Set([1]) },
      scenarioScoresRef: { current: {} },
      currentScenarioRef: { current: 2 },
      resumeActiveScenarioRef: { current: 2 },
    });
    expect(snapshot.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(snapshot.scenariosCompleted).toEqual([1]);
    expect(snapshot.currentScenario).toBe(2);
    expect(snapshot.resumeActiveScenario).toBe(2);
  });
});

describe('installInterviewAuthSignedOutSaveListener', () => {
  it('reads depsRef.current on SIGNED_OUT instead of a stale mount snapshot', async () => {
    const saveInterviewProgress = jest.fn(async () => undefined);
    const setSessionExpired = jest.fn();
    const authCallbackRef: { current: ((event: string) => Promise<void>) | null } = {
      current: null,
    };
    const supabase = {
      auth: {
        onAuthStateChange: (cb: (event: string) => Promise<void>) => {
          authCallbackRef.current = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      },
    };

    const depsRef = {
      current: {
        userId: 'user-1',
        supabase: supabase as never,
        saveInterviewProgress,
        setSessionExpired,
      },
    };

    installInterviewAuthSignedOutSaveListener(depsRef);

    depsRef.current = {
      ...depsRef.current,
      currentMessagesRef: { current: [{ role: 'user', content: 'saved on sign-out' }] },
      scoredScenariosRef: { current: new Set([1]) },
      scenarioScoresRef: { current: {} },
      currentScenarioRef: { current: 1 },
      resumeActiveScenarioRef: { current: 1 },
    };

    await authCallbackRef.current?.('SIGNED_OUT');

    expect(saveInterviewProgress).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        sessionExpired: true,
        messages: [{ role: 'user', content: 'saved on sign-out' }],
      }),
    );
    expect(setSessionExpired).toHaveBeenCalledWith(true);
  });
});
