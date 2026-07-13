import { describe, expect, it } from '@jest/globals';
import { normalizeInterviewTypography } from '../interviewTypography';

describe('normalizeInterviewTypography', () => {
  it('normalizes curly apostrophes and quotes to ASCII', () => {
    expect(normalizeInterviewTypography('don\u2019t say \u201chello\u201d')).toBe(
      "don't say \"hello\"",
    );
  });

  it('leaves plain ASCII unchanged', () => {
    const plain = "It's fine — no change needed.";
    expect(normalizeInterviewTypography(plain)).toBe(plain);
  });
});
