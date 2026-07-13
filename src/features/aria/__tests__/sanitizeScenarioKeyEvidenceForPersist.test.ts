import { describe, expect, it } from '@jest/globals';
import {
  sanitizeScenarioKeyEvidenceRecord,
  sanitizeScenarioScoreBundleForPersist,
  storedKeyEvidenceHasLevelTagLeak,
  stripLegacyLevelTagLeakFromEvidence,
} from '../sanitizeScenarioKeyEvidenceForPersist';

describe('sanitizeScenarioKeyEvidenceForPersist', () => {
  it('strips Level tag missing leak from evidence', () => {
    const raw =
      'high | Level tag missing — prefix keyEvidence with Level 1 — or Level 2 — per behavioral vs interior rubric.';
    expect(stripLegacyLevelTagLeakFromEvidence(raw)).toBe('high');
    expect(storedKeyEvidenceHasLevelTagLeak({ mentalizing: raw })).toBe(true);
  });

  it('sanitizes bundle before persist', () => {
    const out = sanitizeScenarioScoreBundleForPersist({
      pillarScores: { mentalizing: 6 },
      pillarConfidence: { mentalizing: 'high' },
      keyEvidence: {
        mentalizing:
          'Level 2 — User cited felt experience | Level tag missing — prefix keyEvidence with Level 1 —',
      },
    });
    expect(out.keyEvidence.mentalizing).not.toMatch(/Level tag missing/i);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
  });

  it('sanitizeScenarioKeyEvidenceRecord removes leak segments only', () => {
    const out = sanitizeScenarioKeyEvidenceRecord({
      attunement: 'moderate | Level tag missing — prefix keyEvidence',
      repair: 'Level 1 — cited rupture',
    });
    expect(out.attunement).toBe('moderate');
    expect(out.repair).toBe('Level 1 — cited rupture');
  });
});
