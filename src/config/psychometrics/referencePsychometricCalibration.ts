/**
 * Reference psychometric profile used to calibrate modifier bands and auto-fail floors.
 * Scores at or below these levels (worse direction per instrument) receive modifier penalties.
 * Auto-fail floors sit strictly beyond these levels so this profile does not auto-fail.
 */
export const REFERENCE_PSYCHOMETRIC_CALIBRATION = {
  brs: 2.667,
  anxietyTrait: 3,
  scsSf: 3.25,
  gaspExternalization: 4,
  dweck: 3.1,
  aaq2: 31,
  rses: 21,
  rfq: 3.25,
} as const;

export type ReferencePsychometricCalibration = typeof REFERENCE_PSYCHOMETRIC_CALIBRATION;
