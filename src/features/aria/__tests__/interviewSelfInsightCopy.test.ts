import { buildSelfInsightParagraphs } from '../interviewSelfInsightCopy';

describe('buildSelfInsightParagraphs', () => {
  it('maps ego level 3 without numeric label in output', () => {
    const parts = buildSelfInsightParagraphs({ egoDevelopmentLevel: 3 });
    expect(parts[0]).toContain('good foundation');
    expect(parts.join(' ')).not.toMatch(/\b[1-5]\b/);
  });

  it('includes defense copy only when flags are true', () => {
    const none = buildSelfInsightParagraphs({
      defensePatterns: {
        projection_detected: false,
        rationalization_detected: false,
        splitting_detected: false,
        denial_detected: false,
      },
    });
    expect(none.some((p) => p.includes('all-or-nothing'))).toBe(false);

    const split = buildSelfInsightParagraphs({
      defensePatterns: { splitting_detected: true },
    });
    expect(split.some((p) => p.includes('all-or-nothing'))).toBe(true);
    expect(split.join(' ').toLowerCase()).not.toContain('splitting');
  });

  it('emotion bands use raw score', () => {
    const high = buildSelfInsightParagraphs({ emotionRecognitionRawScore: 0.8 });
    expect(high.some((p) => p.includes('real strength'))).toBe(true);
    const mid = buildSelfInsightParagraphs({ emotionRecognitionRawScore: 0.55 });
    expect(mid.some((p) => p.includes('most emotional'))).toBe(true);
    const low = buildSelfInsightParagraphs({ emotionRecognitionRawScore: 0.2 });
    expect(low.some((p) => p.includes('learnable'))).toBe(true);
  });

  it('personal moment both weak vs both strong', () => {
    const weak = buildSelfInsightParagraphs({
      moment4Concreteness: 'absent',
      moment5Concreteness: 'low',
    });
    expect(weak.some((p) => p.includes('general frameworks'))).toBe(true);

    const strong = buildSelfInsightParagraphs({
      moment4Concreteness: 'moderate',
      moment5Concreteness: 'high',
    });
    expect(strong.some((p) => p.includes('readily'))).toBe(true);
  });

  it('mentalizing message only at count >= 2', () => {
    expect(buildSelfInsightParagraphs({ mentalizingOvercertaintyCount: 1 }).join(' ')).not.toContain('quite certain');
    expect(buildSelfInsightParagraphs({ mentalizingOvercertaintyCount: 2 }).join(' ')).toContain('quite certain');
  });

  it('skips calibrated disclosure', () => {
    const p = buildSelfInsightParagraphs({ disclosureCalibration: 'calibrated' });
    expect(p.some((x) => x.includes('pacing'))).toBe(false);
  });
});
