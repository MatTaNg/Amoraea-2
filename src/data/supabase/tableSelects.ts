/** Explicit PostgREST column lists — avoid `select('*')` on wide jsonb rows. */

export const ONBOARDING_PROGRESS_SELECT =
  'user_id, current_step, completed_steps, onboarding_data, updated_at' as const;

export const TYPOLOGY_SELECT =
  'id, profile_id, typology_type, typology_data, created_at, updated_at' as const;

export const COMPATIBILITY_SELECT =
  'id, profile_id, compatibility_data, created_at, updated_at' as const;

export const PROFILE_PHOTO_SELECT =
  'id, profile_id, storage_path, public_url, display_order, created_at' as const;

export const ARIA_SESSION_SELECT = 'id, profile_id, answers, created_at, updated_at' as const;

export const COMMUNICATION_STYLE_PROFILE_SELECT =
  'user_id, emotional_analytical_score, narrative_conceptual_score, certainty_ambiguity_score, relational_individual_score, emotional_vocab_density, qualifier_density, first_person_ratio, avg_response_length, pitch_mean, pitch_range, speech_rate, pause_frequency, energy_variation, emotional_expressiveness, warmth_score, text_confidence, audio_confidence, overall_confidence, updated_at, style_labels_primary, style_labels_secondary, matchmaker_summary, low_confidence_note, source_attempt_id' as const;

/** Alpha / applicant analysis screen (subset of full attempt). */
export const INTERVIEW_ANALYSIS_ATTEMPT_SELECT =
  'id, user_id, weighted_score, passed, pillar_scores, ai_reasoning, transcript' as const;

export const CONFLICT_STYLE_SCORES_SELECT =
  'user_id, competing, collaborating, compromising, avoiding, accommodating, dominant_style, completed_at' as const;
