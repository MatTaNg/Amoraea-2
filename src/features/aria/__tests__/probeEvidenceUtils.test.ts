import { describe, expect, it } from '@jest/globals';
import {
  coerceScoreToFiniteNumber,
  evidenceAbsentForResponseDepthModifier,
  isNotAssessedDueToTechnicalInterruption,
  isPillarConfidenceOnlyEvidence,
  keyEvidenceAbsentForResponseDepthModifier,
  migratePillarConfidenceLeakedIntoKeyEvidence,
  normalizePillarConfidenceToken,
  normalizeScoresByEvidence,
  NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE,
  SKIPPED_BY_USER_FRUSTRATION_EVIDENCE,
} from '../probeEvidenceUtils';

describe('probeEvidenceUtils', () => {
  it('coerces numeric strings for score normalization', () => {
    expect(coerceScoreToFiniteNumber('7')).toBe(7);
    expect(coerceScoreToFiniteNumber('')).toBeUndefined();
  });

  it('does not treat technical non-assessment as absent evidence for depth modifier', () => {
    expect(
      evidenceAbsentForResponseDepthModifier(NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE),
    ).toBe(false);
  });

  it('does not treat frustration skip as absent evidence for depth modifier', () => {
    expect(evidenceAbsentForResponseDepthModifier(SKIPPED_BY_USER_FRUSTRATION_EVIDENCE)).toBe(
      false,
    );
  });

  it('detects technical interruption phrasing', () => {
    expect(
      isNotAssessedDueToTechnicalInterruption(
        'Not assessed — session ended due to technical difficulties before this prompt was delivered.',
      ),
    ).toBe(true);
  });

  it('drops scores paired with no-evidence lines unless intentionally recovered', () => {
    const scores = normalizeScoresByEvidence(
      { repair: 6, mentalizing: '7' },
      {
        repair: 'insufficient evidence to assess repair from this response',
        mentalizing: 'Score recovered from model output.',
      },
    );
    expect(scores).toEqual({ mentalizing: 7 });
  });

  it('treats pillarConfidence tokens leaked into keyEvidence as absent for depth modifier', () => {
    expect(isPillarConfidenceOnlyEvidence('high')).toBe(true);
    expect(isPillarConfidenceOnlyEvidence('moderate')).toBe(true);
    expect(isPillarConfidenceOnlyEvidence('moderate confidence')).toBe(true);
    expect(isPillarConfidenceOnlyEvidence('Level 2 — User inferred inner state.')).toBe(false);
    expect(evidenceAbsentForResponseDepthModifier('moderate')).toBe(true);
    expect(evidenceAbsentForResponseDepthModifier('User said they felt hurt.')).toBe(false);
  });

  it('does not treat confidence-only keyEvidence as absent when scenario transcript is substantive', () => {
    const transcript =
      "Emma felt dismissed and is questioning whether she matters in this relationship at all.";
    expect(keyEvidenceAbsentForResponseDepthModifier('moderate', transcript)).toBe(false);
    expect(keyEvidenceAbsentForResponseDepthModifier('high', transcript)).toBe(false);
    expect(keyEvidenceAbsentForResponseDepthModifier('', transcript)).toBe(true);
  });

  it('migrates confidence-only keyEvidence into pillarConfidence and clears keyEvidence', () => {
    const keyEvidence = {
      mentalizing: 'moderate',
      repair: 'User named the rupture and apologized.',
      attunement: 'high confidence',
    };
    const pillarConfidence: Record<string, string> = {};
    migratePillarConfidenceLeakedIntoKeyEvidence(keyEvidence, pillarConfidence);
    expect(keyEvidence.mentalizing).toBeUndefined();
    expect(keyEvidence.attunement).toBeUndefined();
    expect(keyEvidence.repair).toMatch(/apolog/i);
    expect(pillarConfidence).toEqual({ mentalizing: 'moderate', attunement: 'high' });
    expect(normalizePillarConfidenceToken('medium confidence')).toBe('moderate');
  });
});
