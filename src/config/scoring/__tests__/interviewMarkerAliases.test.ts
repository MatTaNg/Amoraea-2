import { describe, expect, it } from '@jest/globals';
import {
  normalizeInterviewPillarScoreMap,
  withLegacyInterviewPillarAliases,
} from '../interviewMarkerAliases';

describe('normalizeInterviewPillarScoreMap', () => {
  it('maps legacy keys onto canonical ids when canonical is absent', () => {
    expect(
      normalizeInterviewPillarScoreMap({
        contempt: 2,
        attunement: 6,
        commitment_threshold: 5,
      }),
    ).toEqual({
      destructive_conflict: 2,
      responsiveness_support: 6,
      commitment_persistence: 5,
    });
  });

  it('prefers canonical keys when both legacy and new fields are stored', () => {
    expect(
      normalizeInterviewPillarScoreMap({
        contempt: 1,
        destructive_conflict: 8,
        attunement: 2,
        responsiveness_support: 9,
        commitment_threshold: 3,
        commitment_persistence: 7,
      }),
    ).toEqual({
      destructive_conflict: 8,
      responsiveness_support: 9,
      commitment_persistence: 7,
    });
  });

  it('dual-writes aliases without creating extra gate keys', () => {
    const dual = withLegacyInterviewPillarAliases({
      destructive_conflict: 8,
      responsiveness_support: 7,
      commitment_persistence: 6,
    });
    expect(dual.contempt).toBe(8);
    expect(dual.attunement).toBe(7);
    expect(dual.commitment_threshold).toBe(6);
    const normalized = normalizeInterviewPillarScoreMap(dual);
    expect(normalized.destructive_conflict).toBe(8);
    expect(Object.keys(normalized).filter((k) => k === 'contempt' || k === 'destructive_conflict')).toHaveLength(1);
  });
});
