/**
 * Central export for all tunable algorithm configuration.
 * Import from `@config/...` or `@config` in application code.
 */

export * from './scoring/interviewGateThresholds';
export * from './scoring/depthSignalModifiers';
export * from './scoring/scenarioFloors';
export * from './scoring/interviewSkipPenalties';
export * from './scoring/personalMomentConcretenessModifiers';
export * from './scoring/disclosureLevels';
export * from './scoring/elaborationAbsenceCeilings';
export * from './scoring/pillarRollup';
export * from './scoring/emotionRecognitionItems';
export * from './scoring/contemptHeuristics';
export * from './scoring/adminDisplayMargins';

export * from './psychometrics/floors';
export * from './psychometrics/modifierBandPenalties';
export * from './psychometrics/interviewSignalConsistency';
export * from './psychometrics/gamingCorrectionThresholds';
export * from './psychometrics/uncertaintyAndGaming';

export * from './matching/compatibilityScoring';

export * from './reports/pillarNarrativeBands';
export * from './reports/narrativeGateCalibration';
export * from './reports/evidenceConflictThresholds';

export * from './onboarding/assessmentInsightTiers';

export * from './scoring/communicationFloor';
