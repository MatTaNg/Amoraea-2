import { PILLAR_ROLLUP_ALGORITHM_VERSION_CURRENT } from '../algorithmVersions';

/** Regulation may be scored from any of these moments; missing sources are omitted, not zeroed. */
export const REGULATION_SOURCE_SIGNALS_VERSION = `regulation_sources_${PILLAR_ROLLUP_ALGORITHM_VERSION_CURRENT}`;

export const REGULATION_SOURCE_MOMENTS = [
  'scenario_1',
  'scenario_3',
  'moment_4',
  'moment_5',
  'moment_support',
] as const;
