import { describe, expect, it } from 'vitest';
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
});
