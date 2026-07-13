import { APPROVED_ELONGATING_PROBE_LINES } from './elongatingProbe';

export const CLIENT_REPAIR_REFUSAL_PROBE =
  "If you had to try anyway, what's one thing you might say or do?" as const;

export const CLIENT_MENTALIZING_SURFACE_PROBE =
  'What do you think is underneath that for each of them?' as const;

export const SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE =
  'What do you think this pattern of leaving has been like for Sophie over time?' as const;

/** Same verbatim line as approved elongating probes — keeps `elongating_probe_fired` accurate after client inject. */
export const CLIENT_SHORT_ELABORATION_PROBE = APPROVED_ELONGATING_PROBE_LINES[0];
