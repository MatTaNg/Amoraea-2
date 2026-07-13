/**
 * Re-export canonical personal-moment emotional vocabulary (single source of truth for app + edge).
 * Transcript depth enrichment uses client heuristics (moment4/moment5 probes).
 * @see supabase/functions/_shared/personalMomentEmotionalVocab.ts
 */
export * from '../../../supabase/functions/_shared/personalMomentEmotionalVocab';
export {
  combineUserTextForPersonalMoment,
  inferResponseConcretenessFromTranscript,
  enrichPersonalMomentSliceForDepth,
  depthEnrichedMarkerSlices,
} from './personalMomentEmotionalVocabDepthClient';
