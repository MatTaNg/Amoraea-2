import {
  buildEvidenceContextFromAttemptPatterns,
  buildPersonalMomentEvidencePromptBlock,
} from '../narrativeEvidenceAudit';

describe('narrativeEvidenceAudit', () => {
  it('builds M5 scorer notes into prompt block', () => {
    const context = buildEvidenceContextFromAttemptPatterns({
      moment_5_scores: {
        pillarScores: { accountability: 7, mentalizing: 5 },
        keyEvidence: {
          accountability: 'Named own contribution without prompting',
        },
      },
    });
    const block = buildPersonalMomentEvidencePromptBlock(context);
    expect(block).toMatch(/M5/);
    expect(block).toMatch(/accountability/);
    expect(block).toMatch(/Named own contribution/);
  });
});
