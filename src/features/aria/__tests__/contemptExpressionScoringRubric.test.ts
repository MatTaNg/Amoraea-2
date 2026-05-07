import { parseContemptTierBreakdown } from '../contemptExpressionScoringRubric';

describe('parseContemptTierBreakdown', () => {
  it('returns null for null input', () => {
    expect(parseContemptTierBreakdown(null)).toBeNull();
  });

  it('normalizes counts and examples', () => {
    const raw = {
      tier_1: { count: 2, examples: ['Sarah stayed quiet'] },
      tier_2: { count: 1, examples: ["James shouldn't have done that"] },
      tier_3: { count: 0, examples: [] },
    };
    const out = parseContemptTierBreakdown(raw);
    expect(out?.tier_1.count).toBe(2);
    expect(out?.tier_2.count).toBe(1);
    expect(out?.tier_2_statements).toEqual(["James shouldn't have done that"]);
    expect(out?.tier_3.examples).toEqual([]);
    expect(out?.tier_3_statements).toEqual([]);
    expect(out?.tier_3_proportion).toBe(0);
    expect(out?.adjustment_rationale).toBe('No Tier 3 language detected.');
    expect(out?.tier_2_adjustment_rationale).toBeNull();
  });

  it('parses Tier 3 prominence fields', () => {
    const raw = {
      tier_1: { count: 3, examples: ['a'] },
      tier_2: { count: 0, examples: [] },
      tier_3: { count: 1, examples: ["That, or she's gaslighting him"] },
      tier_3_statements: ["That, or she's gaslighting him. One of the three."],
      tier_3_centrality: 'low',
      tier_3_proportion: 8,
      tier_3_conviction: 'hedged',
      tier_3_raw_score: 7.5,
      tier_3_adjusted_score: 2.5,
      adjustment_rationale: 'Single hedged aside after Tier 1 analysis; ~70–80% reduction.',
    };
    const out = parseContemptTierBreakdown(raw);
    expect(out?.tier_3_centrality).toBe('low');
    expect(out?.tier_3_proportion).toBe(8);
    expect(out?.tier_3_conviction).toBe('hedged');
    expect(out?.tier_3_raw_score).toBe(7.5);
    expect(out?.tier_3_adjusted_score).toBe(2.5);
    expect(out?.tier_3_statements[0]).toContain('gaslighting');
    expect(out?.tier_2_adjustment_rationale).toBe('No Tier 2 blame attribution detected.');
  });

  it('parses Tier 2 prominence and tier_3_adjustment_rationale alias', () => {
    const raw = {
      tier_1: { count: 1, examples: ['x'] },
      tier_2: { count: 1, examples: ['James should have known better'] },
      tier_3: { count: 0, examples: [] },
      tier_2_statements: ['James should have known better than to focus on logistics'],
      tier_2_centrality: 'medium',
      tier_2_proportion: 22,
      tier_2_conviction: 'stated_as_fact',
      tier_2_raw_score: 2.8,
      tier_2_adjusted_score: 1.7,
      tier_2_adjustment_rationale: 'Balanced by Tier 1; medium centrality → partial reduction.',
      tier_3_adjustment_rationale: 'ignored when no tier 3',
    };
    const out = parseContemptTierBreakdown(raw);
    expect(out?.tier_2_adjusted_score).toBe(1.7);
    expect(out?.tier_2_adjustment_rationale).toContain('Balanced');
    expect(out?.adjustment_rationale).toBe('No Tier 3 language detected.');
  });
});
