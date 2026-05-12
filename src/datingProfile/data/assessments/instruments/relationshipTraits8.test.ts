import {
  computeRelationshipTraitsQualityFlags,
  scoreRelationshipTraits8,
} from "./relationshipTraits8";

describe("scoreRelationshipTraits8", () => {
  it("reverse-scores items 1, 2, 6 and averages the two dimensions", () => {
    const raw: Record<string, number> = {
      "1": 1,
      "2": 1,
      "3": 7,
      "4": 7,
      "5": 7,
      "6": 1,
      "7": 7,
      "8": 7,
    };
    const s = scoreRelationshipTraits8(raw);
    expect(s.emotional_stability_under_stress).toBeCloseTo(7, 5);
    expect(s.dispositional_trust).toBeCloseTo(7, 5);
  });
});

describe("computeRelationshipTraitsQualityFlags", () => {
  it("flags straight lining for 8 identical answers", () => {
    const raw = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [String(i + 1), 4])
    ) as Record<string, number>;
    const f = computeRelationshipTraitsQualityFlags(raw, 120);
    expect(f.straight_lining).toBe(true);
    expect(f.low_variance).toBe(false);
    expect(f.completed_too_fast).toBe(false);
  });

  it("flags completed_too_fast under threshold", () => {
    const raw: Record<string, number> = {
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "6": 6,
      "7": 7,
      "8": 1,
    };
    const f = computeRelationshipTraitsQualityFlags(raw, 5);
    expect(f.completed_too_fast).toBe(true);
  });
});
