/**
 * Report narrative calibration tied to gate outcomes.
 */

import { GATE_PASS_WEIGHTED_MIN } from '../scoring/interviewGateThresholds';

/** Re-export for reports — always matches gate pass threshold. */
export { GATE_PASS_WEIGHTED_MIN };

/** Points above pass min considered a comfortable pass for narrative tone. */
export const GATE_PASS_COMFORTABLE_MARGIN = 0.5;
