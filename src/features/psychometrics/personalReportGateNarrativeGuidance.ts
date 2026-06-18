/**
 * @deprecated Import from `@features/reports/narrativeCalibration` instead.
 * Re-exports preserved for existing imports and tests.
 */
export type { ReportGateNarrativeTier as PersonalReportGateNarrativeTier } from '@features/reports/narrativeCalibration';
export {
  buildInterviewEvidencePromptBlock,
  composeNarrativeCalibration,
  getGateAwarenessCalibration,
  getInterviewPriorityPrinciple,
  getMechanicsHidingConstraints,
  hasStrongInterviewDerivedPillars,
  isInstrumentFlaggedInGamingCorrection,
  partitionGateFailReasons,
  resolveReportGateNarrativeTier as resolvePersonalReportGateNarrativeTier,
} from '@features/reports/narrativeCalibration';

import type { ReportGateCalibrationInput } from '@features/reports/narrativeCalibration';
import { getGateAwarenessCalibration } from '@features/reports/narrativeCalibration';

/** @deprecated Use getGateAwarenessCalibration from narrativeCalibration */
export function buildPersonalReportGateCalibrationInstructions(
  input: ReportGateCalibrationInput,
): string {
  return getGateAwarenessCalibration(input);
}
