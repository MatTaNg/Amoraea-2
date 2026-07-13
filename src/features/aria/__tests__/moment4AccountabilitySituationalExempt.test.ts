import { describe, expect, it } from '@jest/globals';
import {
  aggregateMarkerScoresFromLabeledSlices,
  aggregatePillarScoresWithCommitmentMergeDetailed,
} from '../aggregateMarkerScoresFromSlices';
import {
  detectMoment4AccountabilitySituationalExempt,
  mergeAccountabilityPillarWhenM4SituationallyExempt,
  MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY,
  resolveMoment4AccountabilitySituationalExempt,
} from '../moment4AccountabilitySituationalExempt';
import { computeGateResultCore } from '../computeGateResultCore';

describe('detectMoment4AccountabilitySituationalExempt', () => {
  it('fires for co-parent abandonment and unpaid child support (Gina-like)', () => {
    const text = `The father of my child owes me over $400 in child support over two years.
      He only saw our two-year-old seven days total. He doesn't show up and I had to walk away.`;
    const result = detectMoment4AccountabilitySituationalExempt(text);
    expect(result.exempt).toBe(true);
    expect(result.reason).toMatch(/co-parenting abandonment|abandonment|child support/i);
  });

  it('fires for abuse and narcissistic behavior disclosures', () => {
    expect(
      detectMoment4AccountabilitySituationalExempt(
        'My ex was emotionally abusive and a narcissist — I went no contact.',
      ).exempt,
    ).toBe(true);
  });

  it('does not fire for mutual conflict without primary other-party harm', () => {
    const mutual = `We both stopped listening. I could have communicated better and so could he.
      It was a mutual breakdown and we worked through it in couples therapy.`;
    expect(detectMoment4AccountabilitySituationalExempt(mutual).exempt).toBe(false);
  });

  it('does not fire for generic philosophical grudge answer', () => {
    expect(
      detectMoment4AccountabilitySituationalExempt(
        "I don't really hold grudges — I try to forgive people and move on.",
      ).exempt,
    ).toBe(false);
  });
});

describe('mergeAccountabilityPillarWhenM4SituationallyExempt', () => {
  it('weights M5 more heavily than M4 when exempt and M5 accountability ≥ 6', () => {
    const { scores, reweightMeta } = mergeAccountabilityPillarWhenM4SituationallyExempt({
      baseScores: { accountability: 4, mentalizing: 6 },
      scenarioAccountabilityScores: [4, 4, 5],
      m4Accountability: 5,
      m5Accountability: 6,
      exempt: {
        exempt: true,
        reason: 'M4 disclosure involves co-parenting abandonment — accountability absence is situationally appropriate',
      },
    });
    expect(reweightMeta?.reweightedAccountability).toBeGreaterThan(4);
    expect(scores.accountability).toBe(reweightMeta?.reweightedAccountability);
    expect(reweightMeta?.weights.find((w) => w.source === 'moment_5')?.weight).toBe(2.5);
    expect(reweightMeta?.weights.find((w) => w.source === 'moment_4')?.weight).toBe(0.25);
  });

  it('leaves scores unchanged when exempt does not fire', () => {
    const base = { accountability: 5, repair: 6 };
    const out = mergeAccountabilityPillarWhenM4SituationallyExempt({
      baseScores: base,
      scenarioAccountabilityScores: [5, 5, 5],
      m4Accountability: 3,
      m5Accountability: 6,
      exempt: { exempt: false, reason: null },
    });
    expect(out.scores).toEqual(base);
    expect(out.reweightMeta).toBeNull();
  });
});

describe('aggregate rollup with M4 exempt', () => {
  it('reweights accountability in full aggregate when M4 metadata flags exempt', () => {
    const slices = [
      { pillarScores: { accountability: 4 }, keyEvidence: { accountability: 's1' } },
      { pillarScores: { accountability: 4 }, keyEvidence: { accountability: 's2' } },
      { pillarScores: { accountability: 5 }, keyEvidence: { accountability: 's3' } },
      {
        pillarScores: { accountability: 5 },
        keyEvidence: { accountability: 'm4 grudge' },
        scoringMetadata: {
          [MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY]: true,
          moment_4_accountability_situationally_exempt_reason:
            'M4 disclosure involves co-parenting abandonment — accountability absence is situationally appropriate',
        },
      },
      { pillarScores: { accountability: 6 }, keyEvidence: { accountability: 'm5 owned my part' } },
    ];
    const agg = aggregatePillarScoresWithCommitmentMergeDetailed(slices);
    expect(agg.moment4AccountabilitySituationallyExempt).toBe(true);
    expect(agg.accountabilityReweightMeta?.reweightedAccountability).toBeGreaterThan(
      agg.accountabilityReweightMeta?.scenarioOnlyAccountability ?? 0,
    );
  });

  it('keeps scenario-only accountability when mutual M4 disclosure (no exempt)', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      {
        moment: 'scenario_1',
        pillarScores: { accountability: 6 },
        keyEvidence: { accountability: 's1' },
      },
      {
        moment: 'scenario_2',
        pillarScores: { accountability: 6 },
        keyEvidence: { accountability: 's2' },
      },
      {
        moment: 'scenario_3',
        pillarScores: { accountability: 6 },
        keyEvidence: { accountability: 's3' },
      },
      {
        moment: 'moment_4',
        pillarScores: { accountability: 4 },
        keyEvidence: { accountability: 'we both contributed' },
      },
      {
        moment: 'moment_5',
        pillarScores: { accountability: 7 },
        keyEvidence: { accountability: 'm5' },
      },
    ]);
    expect(scores.accountability).toBe(6);
  });
});

describe('computeGateResultCore M4 exempt review flag', () => {
  it('adds human-readable review flag when M4 situational exempt', () => {
    const reason =
      'M4 disclosure involves co-parenting abandonment — accountability absence is situationally appropriate';
    const gate = computeGateResultCore(
      { accountability: 5, mentalizing: 6, contempt: 6, repair: 6, regulation: 6, attunement: 6, appreciation: 6 },
      null,
      {
        moment4AccountabilitySituationallyExempt: true,
        moment4AccountabilityExemptReason: reason,
      },
    );
    expect(gate.reviewFlags.some((f) => f.includes('situationally appropriate'))).toBe(true);
    expect(gate.reviewFlags.some((f) => f.includes('weighted toward M5'))).toBe(true);
  });
});

describe('resolveMoment4AccountabilitySituationalExempt', () => {
  it('prefers persisted scoringMetadata over heuristics', () => {
    const resolved = resolveMoment4AccountabilitySituationalExempt({
      scoringMetadata: {
        [MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY]: true,
        moment_4_accountability_situationally_exempt_reason: 'Model reason',
      },
      disclosureText: 'We both could have done better in therapy.',
    });
    expect(resolved.exempt).toBe(true);
    expect(resolved.reason).toBe('Model reason');
  });
});
