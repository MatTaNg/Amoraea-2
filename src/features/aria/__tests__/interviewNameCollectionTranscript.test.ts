import {
  pruneOrphanedPreNameSubstantiveUserTurns,
  shouldPersistNameRetryUserTurnInTranscript,
  userTextLooksLikeSubstantivePreNameMisroute,
} from '@features/aria/interviewNameCollectionTranscript';

describe('interviewNameCollectionTranscript', () => {
  it('flags long scenario-style answers during name capture as misroutes', () => {
    expect(
      userTextLooksLikeSubstantivePreNameMisroute(
        'I think Ryan should have set a boundary with his mom before the date started because it keeps happening.',
      ),
    ).toBe(true);
    expect(shouldPersistNameRetryUserTurnInTranscript('Matt')).toBe(true);
    expect(shouldPersistNameRetryUserTurnInTranscript('I think Ryan should set a boundary with his mom.')).toBe(
      false,
    );
  });

  it('prunes orphaned pre-name substantive user turns before briefing', () => {
    const pruned = pruneOrphanedPreNameSubstantiveUserTurns([
      { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" },
      {
        role: 'user',
        content:
          'I think Emma was being passive aggressive and Ryan needed to address it directly with her on the spot.',
      },
      { role: 'user', content: 'Matt' },
    ]);
    expect(pruned).toHaveLength(2);
    expect(pruned[1]).toMatchObject({ role: 'user', content: 'Matt' });
  });
});
