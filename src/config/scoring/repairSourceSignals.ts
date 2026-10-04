import {
  REPAIR_SOURCE_SIGNALS_VERSION as REPAIR_SOURCE_SIGNALS_VERSION_STAMP,
  REPAIR_SOURCE_SIGNALS_VERSION_V2,
} from '../algorithmVersions';

/**
 * Distinguishable repair evidence sources under a single Repair pillar.
 *
 * Current (v3): hypothetical repair is Scenario 1 (Emma/Ryan acute incident).
 * Autobiographical repair is Moment 5. Spontaneous repair is unprompted evidence
 * in other moments. v2 interviews keep Scenario 3 as the hypothetical source.
 * Do not auto-merge sources or penalize disagreement.
 */

export const REPAIR_SOURCE_SIGNALS_VERSION = REPAIR_SOURCE_SIGNALS_VERSION_STAMP;

export const HYPOTHETICAL_REPAIR_MOMENTS_V2 = ['scenario_3'] as const;
export const HYPOTHETICAL_REPAIR_MOMENTS = ['scenario_1'] as const;
export const AUTOBIOGRAPHICAL_REPAIR_MOMENTS = ['moment_5'] as const;
/**
 * Unprompted repair. S1 is the prompted hypothetical source (v3), so it is not
 * also counted here. S3 may still contribute if the user volunteers repair.
 * M5 conflict resolution is autobiographical, not spontaneous.
 */
export const SPONTANEOUS_REPAIR_MOMENTS_V2 = [
  'scenario_1',
  'scenario_2',
  'moment_4',
  'moment_support',
] as const;
export const SPONTANEOUS_REPAIR_MOMENTS = [
  'scenario_2',
  'scenario_3',
  'moment_4',
  'moment_support',
] as const;

export function repairSourceMomentListsForVersion(version: string | null | undefined): {
  version: string;
  hypothetical: readonly string[];
  spontaneous: readonly string[];
} {
  if (version === REPAIR_SOURCE_SIGNALS_VERSION_V2) {
    return {
      version: REPAIR_SOURCE_SIGNALS_VERSION_V2,
      hypothetical: HYPOTHETICAL_REPAIR_MOMENTS_V2,
      spontaneous: SPONTANEOUS_REPAIR_MOMENTS_V2,
    };
  }
  return {
    version: REPAIR_SOURCE_SIGNALS_VERSION,
    hypothetical: HYPOTHETICAL_REPAIR_MOMENTS,
    spontaneous: SPONTANEOUS_REPAIR_MOMENTS,
  };
}

export const REPAIR_SOURCE_SIGNAL_IDS = [
  'hypothetical_repair',
  'autobiographical_repair',
  'spontaneous_repair',
] as const;

export type RepairSourceSignalId = (typeof REPAIR_SOURCE_SIGNAL_IDS)[number];

/** Review flag only — never an automatic pillar change or discrepancy penalty. */
export const REPAIR_SOURCE_CORRELATION_REVIEW_ABS_R = 0.7;

export const REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO =
  'Evaluate hypothetical (S1) vs autobiographical (M5) repair for agreement, scoring reliability, incremental prediction of downstream outcomes, and whether the gap itself is informative. Do not automatically change the Repair pillar weight, reinterpret v2 Scenario 3 hypothetical scores as Scenario 1, or penalize disagreement based solely on correlation.';
