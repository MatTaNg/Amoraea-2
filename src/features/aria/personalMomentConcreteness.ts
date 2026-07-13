/**
 * Re-export canonical personal-moment concreteness (single source of truth for app + edge).
 * Moment-4 scoring prompts and reconciliation live in the client classification module.
 * @see supabase/functions/_shared/personalMomentConcreteness.ts
 */
export * from '../../../supabase/functions/_shared/personalMomentConcreteness';

export type { Moment4ConcretenessLevel } from './moment4ConcretenessClassification';
export {
  MOMENT4_RESPONSE_CONCRETENESS_SCORING_INSTRUCTION,
  moment4QualifiesAsValidNonApplicable,
  reconcileMoment4Concreteness,
} from './moment4ConcretenessClassification';
