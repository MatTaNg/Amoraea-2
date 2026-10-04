import { describe, expect, it } from '@jest/globals';
import { shouldDeferGatesForDedicatedMetaHandling } from '@features/aria/metaCommentDedicatedPostCommitDeferral';

describe('shouldDeferGatesForDedicatedMetaHandling', () => {
  it('defers on clear skip phrasing even when meta is null', () => {
    expect(shouldDeferGatesForDedicatedMetaHandling(null, 'Can I skip this question?')).toBe(true);
  });

  it('defers on clear skip phrasing even when meta is confusion', () => {
    expect(
      shouldDeferGatesForDedicatedMetaHandling(
        { type: 'confusion', confidence: 0.95 },
        'Can I skip this question?',
      ),
    ).toBe(true);
  });

  it('defers confusion meta types for dedicated post-commit handling', () => {
    expect(
      shouldDeferGatesForDedicatedMetaHandling({ type: 'confusion', confidence: 0.9 }, 'huh?'),
    ).toBe(true);
  });

  it('does not defer ordinary substantive answers', () => {
    expect(
      shouldDeferGatesForDedicatedMetaHandling(
        null,
        'I apologized and we talked through what each of us needed.',
      ),
    ).toBe(false);
  });
});
