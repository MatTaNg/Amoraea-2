/**
 * Leaf string constants for Scenario A contempt / retired S1 repair copy.
 * Keep this module import-free so interview barrels cannot TDZ these strings.
 */

/** Canonical Scenario A contempt probe — client-forced and orphan-stream fallback. */
export const SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY =
  "What about when Emma says 'you've made that very clear' — what do you make of that?";

/** TTS matches show-modal / delivered copy (including Emma's quoted line). */
export const SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;

/** @deprecated Alias — use {@link SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY}. */
export const SCENARIO_A_CONTEMPT_PROBE_RESUME_REPEAT_TTS_COPY = SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;

/** Canonical Scenario A repair ask after the contempt probe — question only (ack is spoken separately). */
export const SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY =
  'If you were Ryan, how would you repair this?';

/** @deprecated Prefer {@link SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}. */
export const S1_REPAIR_QUESTION = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
