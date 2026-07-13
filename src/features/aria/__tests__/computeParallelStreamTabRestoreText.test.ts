import { computeParallelStreamTabRestoreText } from '../computeParallelStreamTabRestoreText';

describe('computeParallelStreamTabRestoreText', () => {
  it('returns remaining text after completed sentences', () => {
    const full = 'Great work. Now tell me about a time you felt hurt.';
    const spoken = 'Great work.';
    expect(computeParallelStreamTabRestoreText(full, spoken, [])).toBe(
      'Now tell me about a time you felt hurt.'
    );
  });

  it('falls back to in-flight sentence when only a prefix was spoken', () => {
    const full = 'Great work. Now tell me about a time you felt hurt.';
    expect(
      computeParallelStreamTabRestoreText(full, '', ['Now tell me about a time you felt hurt.'])
    ).toBe('Now tell me about a time you felt hurt.');
  });

  it('returns full text when no progress tracked', () => {
    const full = 'What happened next in that situation?';
    expect(computeParallelStreamTabRestoreText(full, '', [])).toBe(full);
  });

  it('prefers S3 handoff/vignette over stale S2 James repair when spokenComplete is empty', () => {
    const full =
      "That's the second one done. Nice work, Matt — You saw James's focus on logistics instead of emotions and recognized the need for him to be more present and appreciative. One more situation and then we'll get personal.\n\nSophie and Daniel have had the same argument for the third time this month. When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const staleRepair = 'Got it. And if you were James, how would you repair?';
    expect(computeParallelStreamTabRestoreText(full, '', [staleRepair, staleRepair])).toBe(full);
    expect(computeParallelStreamTabRestoreText(full, '', [staleRepair])).not.toMatch(
      /if you were James/i,
    );
  });

  it('prefers spoken S1→S2 handoff over suppressed Ryan follow-up still in stream accum', () => {
    const handoff =
      "That's a wrap on that one. Nice work, Matt — You saw that Ryan's pattern of redirecting shared time to family was eroding their foundation. We've got two more situations to get through.\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street. When James says 'that's amazing, but I'm on a deadline,' what do you make of that?";
    const unauthorized =
      'Makes sense. What could Ryan have done differently in that moment at dinner to prevent the situation from escalating?';
    expect(computeParallelStreamTabRestoreText(unauthorized, handoff, ['Makes sense.'])).toBe(
      handoff,
    );
    expect(
      computeParallelStreamTabRestoreText(unauthorized, handoff, [unauthorized]),
    ).not.toMatch(/Ryan have done differently/i);
  });

  it('still uses short in-flight probe when stream has not advanced to a later vignette', () => {
    const full = 'Got it. And if you were James, how would you repair?';
    expect(computeParallelStreamTabRestoreText(full, '', [full])).toBe(full);
  });
});
