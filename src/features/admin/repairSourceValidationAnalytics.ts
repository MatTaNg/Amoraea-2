import {
  AUTOBIOGRAPHICAL_REPAIR_MOMENTS,
  HYPOTHETICAL_REPAIR_MOMENTS,
  REPAIR_SOURCE_CORRELATION_REVIEW_ABS_R,
  REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO,
  SPONTANEOUS_REPAIR_MOMENTS,
} from '@config/scoring/repairSourceSignals';
import { hierarchicalR2Increment, meanSd, pearsonR, spearmanBrownFromR } from '@features/admin/scoringStats';

export { REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO };

export type RepairSourceAttemptObservation = {
  userId: string;
  hypothetical: number | null;
  autobiographical: number | null;
  spontaneous: number | null;
  /** S1 and S2 repair when both present — used for spontaneous split-half reliability. */
  spontaneousScenario1?: number | null;
  spontaneousScenario2?: number | null;
  pillarRepair: number | null;
  /** hypothetical − autobiographical; null unless both sources are scored. */
  gapHypoMinusAuto: number | null;
};

export type RepairSourceOutcomeObservation = {
  userId: string;
  outcomeId: string;
  /** Higher is better for the coded downstream outcome. */
  outcome: number;
};

export type RepairSourceReliability = {
  source: 'hypothetical_repair' | 'autobiographical_repair' | 'spontaneous_repair';
  n: number;
  mean: number | null;
  sd: number | null;
  singleItem: boolean;
  /** Correlation with the rolled Repair pillar (concurrent, not a change rule). */
  itemTotalR: number | null;
  /** Spearman–Brown from S1 vs S2 when both exist (spontaneous only). */
  splitHalfReliability: number | null;
};

export type RepairSourceIncrementalValidity = {
  outcomeId: string;
  n: number;
  rHypothetical: number | null;
  rAutobiographical: number | null;
  rSpontaneous: number | null;
  rGap: number | null;
  /** ΔR² of hypothetical after autobiographical. */
  incrementalHypotheticalAfterAutobiographical: number | null;
  /** ΔR² of autobiographical after hypothetical. */
  incrementalAutobiographicalAfterHypothetical: number | null;
  /** ΔR² of spontaneous after both primary sources (uses hypothetical as the base when auto missing). */
  incrementalSpontaneousAfterPrimary: number | null;
  /** ΔR² of the hypo−auto gap after both primary sources. */
  incrementalGapAfterPrimary: number | null;
};

export type RepairSourceValidationReport = {
  agreement: {
    n: number;
    rHypotheticalAutobiographical: number | null;
    reviewFlag: boolean;
  };
  reliability: RepairSourceReliability[];
  incrementalValidity: RepairSourceIncrementalValidity[];
  spontaneousPresence: {
    nAttempts: number;
    nWithSpontaneous: number;
    rate: number | null;
  };
  noAutoChangeTodo: string;
};

function paired(
  rows: RepairSourceAttemptObservation[],
  a: keyof RepairSourceAttemptObservation,
  b: keyof RepairSourceAttemptObservation,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const av = row[a];
    const bv = row[b];
    if (typeof av === 'number' && Number.isFinite(av) && typeof bv === 'number' && Number.isFinite(bv)) {
      xs.push(av);
      ys.push(bv);
    }
  }
  return { xs, ys };
}

function joinOutcome(
  attempts: RepairSourceAttemptObservation[],
  outcomes: RepairSourceOutcomeObservation[],
  outcomeId: string,
): Array<RepairSourceAttemptObservation & { outcome: number }> {
  const byUser = new Map<string, RepairSourceAttemptObservation>();
  for (const row of attempts) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, row);
  }
  const joined: Array<RepairSourceAttemptObservation & { outcome: number }> = [];
  for (const o of outcomes) {
    if (o.outcomeId !== outcomeId) continue;
    const attempt = byUser.get(o.userId);
    if (!attempt || !Number.isFinite(o.outcome)) continue;
    joined.push({ ...attempt, outcome: o.outcome });
  }
  return joined;
}

function finiteCol(
  rows: Array<RepairSourceAttemptObservation & { outcome: number }>,
  key: keyof RepairSourceAttemptObservation | 'outcome',
): number[] {
  return rows.map((r) => {
    const v = r[key as keyof typeof r];
    return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
  });
}

/**
 * Evaluation-only repair-source analytics.
 * High agreement is a review flag, never a merge/penalty/restore-probes rule.
 */
export function evaluateRepairSourceValidation(args: {
  attempts: RepairSourceAttemptObservation[];
  outcomes?: RepairSourceOutcomeObservation[];
}): RepairSourceValidationReport {
  const { attempts, outcomes = [] } = args;
  const hypoAuto = paired(attempts, 'hypothetical', 'autobiographical');
  const rHypoAuto = pearsonR(hypoAuto.xs, hypoAuto.ys);
  const hypoVsPillar = paired(attempts, 'hypothetical', 'pillarRepair');
  const autoVsPillar = paired(attempts, 'autobiographical', 'pillarRepair');
  const spontVsPillar = paired(attempts, 'spontaneous', 'pillarRepair');
  const s1s2 = paired(attempts, 'spontaneousScenario1', 'spontaneousScenario2');

  const hypoVals = attempts.map((r) => r.hypothetical).filter((v): v is number => typeof v === 'number');
  const autoVals = attempts.map((r) => r.autobiographical).filter((v): v is number => typeof v === 'number');
  const spontVals = attempts.map((r) => r.spontaneous).filter((v): v is number => typeof v === 'number');

  const reliability: RepairSourceReliability[] = [
    {
      source: 'hypothetical_repair',
      ...meanSd(hypoVals),
      singleItem: true,
      itemTotalR: pearsonR(hypoVsPillar.xs, hypoVsPillar.ys),
      splitHalfReliability: null,
    },
    {
      source: 'autobiographical_repair',
      ...meanSd(autoVals),
      singleItem: true,
      itemTotalR: pearsonR(autoVsPillar.xs, autoVsPillar.ys),
      splitHalfReliability: null,
    },
    {
      source: 'spontaneous_repair',
      ...meanSd(spontVals),
      singleItem: false,
      itemTotalR: pearsonR(spontVsPillar.xs, spontVsPillar.ys),
      splitHalfReliability: spearmanBrownFromR(pearsonR(s1s2.xs, s1s2.ys)),
    },
  ];

  const outcomeIds = [...new Set(outcomes.map((o) => o.outcomeId))];
  const incrementalValidity: RepairSourceIncrementalValidity[] = outcomeIds.map((outcomeId) => {
    const joined = joinOutcome(attempts, outcomes, outcomeId);
    const y = finiteCol(joined, 'outcome');
    const hypo = finiteCol(joined, 'hypothetical');
    const auto = finiteCol(joined, 'autobiographical');
    const spont = finiteCol(joined, 'spontaneous');
    const gap = finiteCol(joined, 'gapHypoMinusAuto');
    const hypoAfterAuto = hierarchicalR2Increment(auto, hypo, y);
    const autoAfterHypo = hierarchicalR2Increment(hypo, auto, y);
    const primary = auto.map((v, i) => (Number.isFinite(v) ? v : hypo[i]));
    const spontInc = hierarchicalR2Increment(primary, spont, y);
    const gapInc = hierarchicalR2Increment(primary, gap, y);
    return {
      outcomeId,
      n: joined.length,
      rHypothetical: pearsonR(hypo, y),
      rAutobiographical: pearsonR(auto, y),
      rSpontaneous: pearsonR(spont, y),
      rGap: pearsonR(gap, y),
      incrementalHypotheticalAfterAutobiographical: hypoAfterAuto.deltaR2,
      incrementalAutobiographicalAfterHypothetical: autoAfterHypo.deltaR2,
      incrementalSpontaneousAfterPrimary: spontInc.deltaR2,
      incrementalGapAfterPrimary: gapInc.deltaR2,
    };
  });

  const spontPresenceN = attempts.filter(
    (r) => typeof r.spontaneous === 'number' && Number.isFinite(r.spontaneous),
  ).length;

  return {
    agreement: {
      n: hypoAuto.xs.length,
      rHypotheticalAutobiographical: rHypoAuto,
      reviewFlag: rHypoAuto != null && Math.abs(rHypoAuto) >= REPAIR_SOURCE_CORRELATION_REVIEW_ABS_R,
    },
    reliability,
    incrementalValidity,
    spontaneousPresence: {
      nAttempts: attempts.length,
      nWithSpontaneous: spontPresenceN,
      rate: attempts.length > 0 ? spontPresenceN / attempts.length : null,
    },
    noAutoChangeTodo: REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO,
  };
}

export const REPAIR_SOURCE_MOMENT_MAP = {
  hypothetical_repair: HYPOTHETICAL_REPAIR_MOMENTS,
  autobiographical_repair: AUTOBIOGRAPHICAL_REPAIR_MOMENTS,
  spontaneous_repair: SPONTANEOUS_REPAIR_MOMENTS,
} as const;
