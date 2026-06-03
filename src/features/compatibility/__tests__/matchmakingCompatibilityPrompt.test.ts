import {
  buildMatchmakingCompatibilityPrompt,
  buildMatchmakingPairPayloadExample,
  MATCHMAKING_COMPATIBILITY_SYSTEM_PROMPT,
} from '../matchmakingCompatibilityPrompt';

describe('matchmakingCompatibilityPrompt', () => {
  it('includes system rubric and serialized pair payload', () => {
    const payload = buildMatchmakingPairPayloadExample();
    const { system, user } = buildMatchmakingCompatibilityPrompt(payload);

    expect(system).toBe(MATCHMAKING_COMPATIBILITY_SYSTEM_PROMPT);
    expect(system).toContain('attachment (35% weight)');
    expect(system).toContain('compatibilityScoreNormalized');

    expect(user).toContain('user-a-example');
    expect(user).toContain('user-b-example');
    expect(user).toContain('"schemaVersion": 1');
    expect(user).toContain('Respond with a single JSON object only');
  });

  it('example payload satisfies schemaVersion 1', () => {
    const payload = buildMatchmakingPairPayloadExample();
    expect(payload.schemaVersion).toBe(1);
    expect(payload.userA.interview?.passed).toBe(true);
    expect(payload.userB.postInterviewTypology?.attachment?.style).toBe('secure');
  });
});
