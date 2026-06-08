import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { supabase } from '@data/supabase/client';
import { sexualCommunicationBand, formatSexualCommunicationCompletedAt } from '@features/psychometrics/postInterviewSexualCommunicationService';
import {
  GamingCorrectionBanner,
  GamingCorrectionCard,
} from '@features/admin/GamingCorrectionCard';
import type { GamingCorrectionResult } from '@features/psychometrics/computeGamingCorrection';
import {
  formatPsychometricGateFailDescription,
  getRetroactivePsychometricFloorReviews,
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  psychometricFloorScoreForUser,
  wouldTriggerAaq2HighExperientialAvoidanceFloor,
  wouldTriggerAnxietyTraitHighFloor,
  wouldTriggerBrsLowResilienceFloor,
  wouldTriggerDweckExtremeFixedMindsetFloor,
  wouldTriggerGaspExtremeExternalizationFloor,
  wouldTriggerRfqLowReflectiveFunctioningFloor,
  wouldTriggerRsesLowSelfEsteemFloor,
  wouldTriggerScsLowPrivateSelfAwarenessFloor,
  wouldTriggerScsSfLowSelfCompassionFloor,
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
  BRS_LOW_RESILIENCE_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  RFQ_STRAIGHT_LINE_FLAG,
  RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
  SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
} from '@features/psychometrics/psychometricFloorBreaches';
import {
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
  wouldTriggerSd3NarcissismFloor,
} from '@features/psychometrics/sd3NarcissismFloor';
import { sd3NarcissismScoreFromUserRow } from '@features/psychometrics/usersPsychometricsSchemaFallback';
import { LifeDomainAnswersSection } from '@app/screens/admin/LifeDomainAnswersSection';

export type AdminUserProfileRecord = {
  id: string;
  market_research_completed_at: string | null;
  market_research_referral_source: string | null;
  market_research_referral_other: string | null;
  market_research_relationship_seriousness: string | null;
  market_research_search_duration: string | null;
  market_research_dating_status: string | null;
  market_research_max_spend: string | null;
  market_research_spend_context: string | null;
  psychometrics_completed_at: string | null;
  psychometrics_brs_score: number | null;
  psychometrics_anxiety_trait_score: number | null;
  psychometrics_scs_sf_score: number | null;
  psychometrics_scs_sf_self_kindness_score: number | null;
  psychometrics_scs_sf_common_humanity_score: number | null;
  psychometrics_scs_sf_mindfulness_score: number | null;
  psychometrics_gasp_score: number | null;
  psychometrics_gasp_guilt_repair_score: number | null;
  psychometrics_gasp_shame_withdraw_score: number | null;
  psychometrics_dweck_score: number | null;
  psychometrics_dweck_growth_score: number | null;
  psychometrics_dweck_rbi_disagreement_score: number | null;
  psychometrics_aaq2_score: number | null;
  psychometrics_rses_score: number | null;
  psychometrics_scs_public_score: number | null;
  psychometrics_scs_private_score: number | null;
  psychometrics_mspss_score: number | null;
  psychometrics_mspss_family_score: number | null;
  psychometrics_mspss_friends_score: number | null;
  psychometrics_sd3_narcissism_score: number | null;
  psychometrics_rfq_score: number | null;
  psychometric_modifier: number | null;
  psychometric_consistency_flags: unknown;
  psychometric_straight_line_flags: unknown;
  psychometrics_sexual_communication_score: number | null;
  psychometrics_sexual_communication_completed_at: string | null;
};

export type AdminAttemptAssessmentRecord = {
  weighted_score: number | null;
  passed: boolean | null;
  score_modifier: number | null;
  depth_signal_modifier: number | null;
  psychometric_modifier_applied: number | null;
  corrected_psychometric_modifier?: number | null;
  gaming_correction?: GamingCorrectionResult | null;
  modified_weighted_score_with_psychometrics: number | null;
  final_gate_pass: boolean | null;
  gate_fail_reasons?: unknown;
  disclosure_calibration: string | null;
  personal_moment_emotional_vocab_low: boolean | null;
  personal_moment_emotional_vocab_density: number | null;
};

const ADMIN_USER_PROFILE_SELECT = `
  id,
  market_research_completed_at,
  market_research_referral_source,
  market_research_referral_other,
  market_research_relationship_seriousness,
  market_research_search_duration,
  market_research_dating_status,
  market_research_max_spend,
  market_research_spend_context,
  psychometrics_completed_at,
  psychometrics_brs_score,
  psychometrics_anxiety_trait_score,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_self_kindness_score,
  psychometrics_scs_sf_common_humanity_score,
  psychometrics_scs_sf_mindfulness_score,
  psychometrics_gasp_score,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_mspss_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_friends_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_rfq_score,
  psychometric_modifier,
  psychometric_consistency_flags,
  psychometric_straight_line_flags
`;

/** Requires migration 20260623120000_users_psychometrics_sexual_communication.sql */
const ADMIN_USER_PROFILE_SEXUAL_COMMUNICATION_COLUMNS = `
  psychometrics_sexual_communication_score,
  psychometrics_sexual_communication_completed_at`;

/** Fallback when newer psychometric columns are not migrated yet (avoids whole-row SELECT failure). */
const ADMIN_USER_PROFILE_SELECT_LEGACY = `
  id,
  market_research_completed_at,
  market_research_referral_source,
  market_research_referral_other,
  market_research_relationship_seriousness,
  market_research_search_duration,
  market_research_dating_status,
  market_research_max_spend,
  market_research_spend_context,
  psychometrics_completed_at,
  psychometrics_brs_score,
  psychometrics_anxiety_trait_score,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_self_kindness_score,
  psychometrics_scs_sf_common_humanity_score,
  psychometrics_scs_sf_mindfulness_score,
  psychometrics_gasp_score,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_mspss_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_friends_score,
  psychometrics_narq_s_score,
  psychometric_modifier,
  psychometric_consistency_flags,
  psychometric_straight_line_flags
`;

/** Psychometric + gate fields only — avoids failures when market-research or post-interview columns are unmigrated. */
const ADMIN_USER_PSYCHOMETRICS_SELECT = `
  id,
  psychometrics_completed_at,
  psychometrics_brs_score,
  psychometrics_anxiety_trait_score,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_self_kindness_score,
  psychometrics_scs_sf_common_humanity_score,
  psychometrics_scs_sf_mindfulness_score,
  psychometrics_gasp_score,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_mspss_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_friends_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_rfq_score,
  psychometric_modifier,
  psychometric_consistency_flags,
  psychometric_straight_line_flags
`;

/** When 20260527210000_users_psychometrics_brs.sql has not been applied yet. */
const ADMIN_USER_PSYCHOMETRICS_SELECT_WITHOUT_BRS = `
  id,
  psychometrics_completed_at,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_self_kindness_score,
  psychometrics_scs_sf_common_humanity_score,
  psychometrics_scs_sf_mindfulness_score,
  psychometrics_gasp_score,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_mspss_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_friends_score,
  psychometrics_narq_s_score,
  psychometrics_rfq_score,
  psychometric_modifier,
  psychometric_consistency_flags,
  psychometric_straight_line_flags
`;

/** Oldest psychometric battery columns (AAQ-II / RSES / SCS) — last-resort admin read. */
const ADMIN_USER_PSYCHOMETRICS_SELECT_MINIMAL = `
  id,
  psychometrics_completed_at,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometric_modifier,
  psychometric_consistency_flags,
  psychometric_straight_line_flags
`;

export function isRecoverableUsersSelectError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? '');
  const code = String(error.code ?? '');
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function emptyAdminUserProfileFields(userId: string): AdminUserProfileRecord {
  return {
    id: userId,
    market_research_completed_at: null,
    market_research_referral_source: null,
    market_research_referral_other: null,
    market_research_relationship_seriousness: null,
    market_research_search_duration: null,
    market_research_dating_status: null,
    market_research_max_spend: null,
    market_research_spend_context: null,
    psychometrics_completed_at: null,
    psychometrics_brs_score: null,
    psychometrics_anxiety_trait_score: null,
    psychometrics_scs_sf_score: null,
    psychometrics_scs_sf_self_kindness_score: null,
    psychometrics_scs_sf_common_humanity_score: null,
    psychometrics_scs_sf_mindfulness_score: null,
    psychometrics_gasp_score: null,
    psychometrics_gasp_guilt_repair_score: null,
    psychometrics_gasp_shame_withdraw_score: null,
    psychometrics_dweck_score: null,
    psychometrics_dweck_growth_score: null,
    psychometrics_dweck_rbi_disagreement_score: null,
    psychometrics_aaq2_score: null,
    psychometrics_rses_score: null,
    psychometrics_scs_public_score: null,
    psychometrics_scs_private_score: null,
    psychometrics_mspss_score: null,
    psychometrics_mspss_family_score: null,
    psychometrics_mspss_friends_score: null,
    psychometrics_sd3_narcissism_score: null,
    psychometrics_rfq_score: null,
    psychometric_modifier: null,
    psychometric_consistency_flags: null,
    psychometric_straight_line_flags: null,
    psychometrics_sexual_communication_score: null,
    psychometrics_sexual_communication_completed_at: null,
  };
}

function normalizeAdminUserProfileRow(userId: string, data: Record<string, unknown>): AdminUserProfileRecord {
  return {
    ...emptyAdminUserProfileFields(userId),
    ...(data as AdminUserProfileRecord),
    id: userId,
    psychometrics_sd3_narcissism_score: sd3NarcissismScoreFromUserRow(data),
    psychometrics_rfq_score: (data.psychometrics_rfq_score as number | null | undefined) ?? null,
  };
}

function userHasStoredPsychometricScores(user: AdminUserProfileRecord): boolean {
  return (
    user.psychometrics_brs_score != null ||
    user.psychometrics_anxiety_trait_score != null ||
    user.psychometrics_scs_sf_score != null ||
    user.psychometrics_gasp_score != null ||
    user.psychometrics_dweck_score != null ||
    user.psychometrics_aaq2_score != null ||
    user.psychometrics_rses_score != null ||
    user.psychometrics_scs_public_score != null ||
    user.psychometrics_scs_private_score != null ||
    user.psychometrics_mspss_friends_score != null ||
    user.psychometrics_sd3_narcissism_score != null ||
    user.psychometrics_rfq_score != null
  );
}

function attemptHasPsychometricModifierApplied(attempt: AdminAttemptAssessmentRecord): boolean {
  return (
    attempt.psychometric_modifier_applied != null ||
    attempt.modified_weighted_score_with_psychometrics != null
  );
}

export async function fetchAdminUserProfile(
  userId: string,
): Promise<AdminUserProfileRecord | null> {
  /** Richest selects first — minimal variants succeed on any DB and would hide SD3/RFQ/BRS if tried first. */
  const selectVariants = [
    `${ADMIN_USER_PROFILE_SELECT},${ADMIN_USER_PROFILE_SEXUAL_COMMUNICATION_COLUMNS}`,
    ADMIN_USER_PROFILE_SELECT,
    `${ADMIN_USER_PROFILE_SELECT_LEGACY},${ADMIN_USER_PROFILE_SEXUAL_COMMUNICATION_COLUMNS}`,
    ADMIN_USER_PROFILE_SELECT_LEGACY,
    ADMIN_USER_PSYCHOMETRICS_SELECT,
    ADMIN_USER_PSYCHOMETRICS_SELECT_WITHOUT_BRS,
    ADMIN_USER_PSYCHOMETRICS_SELECT_MINIMAL,
  ];

  let lastError: { message?: string; code?: string } | null = null;

  for (const select of selectVariants) {
    const result = await supabase.from('users').select(select).eq('id', userId).maybeSingle();
    if (!result.error && result.data) {
      return normalizeAdminUserProfileRow(userId, result.data as Record<string, unknown>);
    }
    lastError = result.error;
    if (result.error && !isRecoverableUsersSelectError(result.error)) {
      break;
    }
  }

  if (lastError) {
    console.error('[Admin] fetchAdminUserProfile:', lastError);
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function computeLeadQuality(
  seriousness: string | null,
  duration: string | null,
  spend: string | null,
): { level: 'High' | 'Medium' | 'Low'; color: string; reason: string } {
  if (!seriousness || !duration || !spend) {
    return { level: 'Low', color: '#999', reason: 'Incomplete market research data' };
  }

  const isVerySerious = seriousness === 'Very seriously';
  const isSerious = seriousness === 'Seriously';
  const longSearch = duration === '1 to 3 years' || duration === 'More than 3 years';
  const highSpend =
    spend === '501 - 1,000' ||
    spend === '1,001 - 3,000' ||
    spend === '3,001 - 5,000' ||
    spend === '5,001 - 10,000' ||
    spend === '10,000+';
  const curious = seriousness === 'Mostly curious';

  if (isVerySerious && longSearch && highSpend) {
    return {
      level: 'High',
      color: '#22c55e',
      reason: 'Very serious, long search, significant prior investment',
    };
  }
  if (isVerySerious && (longSearch || highSpend)) {
    return {
      level: 'High',
      color: '#22c55e',
      reason: 'Very serious with either long search history or high prior spend',
    };
  }
  if (curious || (!isVerySerious && !isSerious)) {
    return {
      level: 'Low',
      color: '#ef4444',
      reason: 'Low stated intent or primarily curious',
    };
  }
  return {
    level: 'Medium',
    color: '#f59e0b',
    reason: 'Moderate intent and engagement',
  };
}

const CONSISTENCY_FLAG_DESCRIPTIONS: Record<string, string> = {
  aaq2_consistency_review:
    'Self-report suggests high psychological flexibility but interview behavior shows limited personal disclosure and emotional vocabulary. May reflect structured-context performance rather than day-to-day pattern.',
  rses_consistency_review:
    "Self-reported self-esteem and interview accountability signals point in opposite directions. High self-esteem with low interview accountability may indicate narcissistic presentation. Low self-esteem with high interview accountability may reflect genuine growth or structured-context compensation.",
  scs_consistency_review:
    'Strong external self-orientation on self-report but interview shows calibrated disclosure and rich personal engagement. Consider whether self-report accurately reflects daily experience.',
  gasp_consistency_review:
    'Self-report suggests high blame externalization, but interview accountability signals are strong. Consider whether defensive attribution style appears under stress rather than as a stable pattern.',
  sd3_narcissism_contempt_divergence:
    'High SD3 narcissism self-report but low contempt signals in structured scenarios.',
};

const STRAIGHT_LINE_FLAG_DESCRIPTIONS: Record<string, string> = {
  brs_straight_line:
    'Resilience Assessment responses are all identical — implausible given alternating item direction. May indicate inattentive or strategic responding.',
  anxiety_trait_straight_line:
    'Emotional Patterns Assessment responses are all identical — implausible given alternating item direction. May indicate inattentive or strategic responding.',
  aaq2_straight_line:
    'Emotional Flexibility Assessment responses show an implausible straight-line pattern. May indicate inattentive or strategic responding.',
  rses_straight_line:
    'Self-Esteem Assessment responses show an implausible straight-line pattern. May indicate inattentive or strategic responding.',
  scs_straight_line:
    'Self-Awareness Assessment responses show an implausible straight-line pattern. May indicate inattentive or strategic responding.',
  scs_sf_straight_line:
    'Self-Compassion Assessment responses are all identical — implausible given alternating item direction.',
  gasp_straight_line:
    'Responsibility Assessment responses are all identical — may indicate inattentive responding.',
  dweck_straight_line:
    'Relationship Beliefs Assessment responses are all identical — may indicate inattentive responding.',
  mspss_straight_line:
    'Social Support Assessment responses are all identical at an extreme endpoint — may indicate inattentive responding.',
  sd3_narcissism_straight_line:
    'Social Perceptions Assessment responses are all identical — implausible given forward and reverse-scored items. May indicate inattentive or strategic responding.',
  rfq_straight_line:
    'Self-Reflection Assessment responses are all identical — may indicate inattentive or strategic responding.',
};

function psychometricFloorScoresFromUser(user: AdminUserProfileRecord) {
  return {
    rfqScore: user.psychometrics_rfq_score,
    gaspScore: user.psychometrics_gasp_score,
    dweckScore: user.psychometrics_dweck_score,
    scsSfScore: user.psychometrics_scs_sf_score,
    sd3NarcissismScore: user.psychometrics_sd3_narcissism_score,
    brsScore: user.psychometrics_brs_score,
    anxietyTraitScore: user.psychometrics_anxiety_trait_score,
    aaq2Score: user.psychometrics_aaq2_score,
    rsesScore: user.psychometrics_rses_score,
    scsPublicScore: user.psychometrics_scs_public_score,
    scsPrivateScore: user.psychometrics_scs_private_score,
  };
}

function getBrsBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 4.0) {
    return {
      band: 'High resilience',
      modifier: 0,
      description:
        'Strong ability to recover from stress and adversity. Associated with emotional stability and sustained engagement through relational difficulty.',
    };
  }
  if (score >= 3.0) {
    return {
      band: 'Moderate resilience',
      modifier: 0,
      description: 'Average recovery capacity from stress. Generally able to bounce back with some difficulty.',
    };
  }
  return {
    band: 'Low resilience',
    modifier: -0.15,
    description:
      'Limited recovery capacity from stressful experiences. May struggle to maintain emotional stability through sustained relational difficulty.',
  };
}

function getAnxietyTraitBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 4.0) {
    return {
      band: 'High chronic anxiety',
      modifier: -0.15,
      description:
        'Elevated trait worry and tension in daily life. Associated with relational hypervigilance and difficulty settling after minor setbacks.',
    };
  }
  if (score >= 3.0) {
    return {
      band: 'Moderate anxiety',
      modifier: 0,
      description: 'Average worry and tension levels — neither strongly elevated nor notably calm.',
    };
  }
  return {
    band: 'Low anxiety',
    modifier: 0,
    description:
      'Generally calm baseline with limited chronic worry. Neutral modifier — favorable bands do not boost the gate score.',
  };
}

function getScsSfBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 4.0) {
    return {
      band: 'High self-compassion',
      modifier: 0,
      description:
        'Treats themselves with kindness and balance during difficulty. Associated with healthier self-talk and recovery after relational setbacks.',
    };
  }
  if (score >= 3.0) {
    return {
      band: 'Moderate self-compassion',
      modifier: 0,
      description: 'Average self-kindness under stress with some self-criticism or rumination.',
    };
  }
  return {
    band: 'Low self-compassion',
    modifier: -0.2,
    description:
      'Harsh self-judgment and difficulty soothing themselves when things go wrong. May amplify shame and withdrawal in relationships.',
  };
}

function getGaspBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score <= 2.5) {
    return {
      band: 'Low externalization',
      modifier: 0,
      description:
        'Tends to take responsibility rather than blame others when things go wrong. Associated with accountability in conflict repair.',
    };
  }
  if (score <= 4.5) {
    return {
      band: 'Moderate externalization',
      modifier: 0,
      description: 'Mixed attribution — sometimes owns mistakes, sometimes deflects blame.',
    };
  }
  return {
    band: 'High externalization',
    modifier: -0.25,
    description:
      'Frequently attributes fault to others or circumstances. May limit accountability and repair in relationships.',
  };
}

function getDweckBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 4.5) {
    return {
      band: 'Growth mindset',
      modifier: 0,
      description:
        'Believes partners can change and grow. Associated with patience through conflict and investment in development.',
    };
  }
  if (score >= 3.5) {
    return {
      band: 'Mixed mindset',
      modifier: 0,
      description: 'Some belief that relationship qualities can change, with reservations.',
    };
  }
  if (score >= 2.5) {
    return {
      band: 'Fixed-leaning mindset',
      modifier: -0.1,
      description:
        'Tends to view partner traits as relatively fixed. May reduce effort during difficulty or amplify disappointment.',
    };
  }
  return {
    band: 'Fixed mindset',
    modifier: -0.2,
    description:
      'Strong belief that who someone is as a partner cannot change much. Associated with premature exit or chronic dissatisfaction.',
  };
}

function getMspssBand(friendsScore: number | null): { band: string; modifier: number; description: string } {
  if (friendsScore === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (friendsScore >= 5.5) {
    return {
      band: 'Strong social network',
      modifier: 0,
      description:
        'Strong perceived support from friends. Associated with lower relational dependency and healthier boundary maintenance.',
    };
  }
  if (friendsScore >= 4.0) {
    return {
      band: 'Adequate social network',
      modifier: 0,
      description: 'Moderate friend support — neither a strong asset nor a dependency risk signal.',
    };
  }
  if (friendsScore >= 2.5) {
    return {
      band: 'Limited social network',
      modifier: -0.1,
      description:
        'Limited perceived friend support. May increase reliance on a romantic partner for emotional needs.',
    };
  }
  return {
    band: 'Isolated — high dependency risk',
    modifier: -0.2,
    description:
      'Very low perceived friend support. High risk of over-reliance on a partner for emotional regulation and support.',
  };
}

function getSd3NarcissismBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 4.0) {
    return {
      band: 'Floor breach',
      modifier: -0.25,
      description:
        'Floor breach — grandiose entitlement at level incompatible with reciprocal intimate partnership.',
    };
  }
  if (score <= 2.0) {
    return {
      band: 'Low narcissism',
      modifier: 0,
      description: 'Low narcissism — minimal self-enhancement or entitlement signals.',
    };
  }
  if (score <= 3.5) {
    return {
      band: 'Moderate narcissism',
      modifier: 0,
      description:
        'Moderate narcissism — within normal range for self-confidence and social assertion.',
    };
  }
  return {
    band: 'High narcissism',
    modifier: -0.25,
    description:
      'High narcissism — elevated entitlement and self-enhancement signals. Monitor against contempt pillar for consistency.',
  };
}

function getRfqBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 5.0) {
    return {
      band: 'Strong reflective functioning',
      modifier: 0,
      description:
        'Strong capacity to understand own and others mental states and link past experience to present feelings.',
    };
  }
  if (score >= 3.5) {
    return {
      band: 'Moderate reflective functioning',
      modifier: 0,
      description: 'Average reflective capacity with some gaps in mentalizing self and others.',
    };
  }
  return {
    band: 'Limited reflective functioning',
    modifier: -0.15,
    description:
      'Limited reflective functioning — difficulty understanding motivations and linking experience to feelings.',
  };
}

function getAaq2Band(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score <= 14)
    return {
      band: 'High flexibility',
      modifier: 0,
      description:
        'Strong willingness to experience difficult emotions without avoidance. Associated with better emotional presence in conflict.',
    };
  if (score <= 24)
    return {
      band: 'Moderate flexibility',
      modifier: 0,
      description: 'Generally able to engage with difficult emotions with some avoidance tendencies.',
    };
  if (score <= 34)
    return {
      band: 'Mild avoidance',
      modifier: -0.2,
      description:
        'Some tendency to avoid difficult internal experiences. May struggle with emotional presence during relational stress.',
    };
  if (score <= 44)
    return {
      band: 'High avoidance',
      modifier: -0.4,
      description:
        'Significant avoidance of difficult emotions. Likely to withdraw from emotional intimacy and conflict engagement.',
    };
  return {
    band: 'Severe avoidance',
    modifier: -0.6,
    description:
      'Pervasive avoidance of internal experience. Represents a significant structural barrier to emotional intimacy.',
  };
}

function getRsesBand(score: number | null): { band: string; modifier: number; description: string } {
  if (score === null) return { band: 'Not assessed', modifier: 0, description: '' };
  if (score >= 30)
    return {
      band: 'High self-esteem',
      modifier: 0,
      description:
        'Stable self-regard. Associated with lower rejection sensitivity and more secure relational functioning.',
    };
  if (score >= 23)
    return {
      band: 'Moderate-high self-esteem',
      modifier: 0,
      description: 'Generally positive self-regard with some variability.',
    };
  if (score >= 17)
    return {
      band: 'Moderate-low self-esteem',
      modifier: -0.2,
      description:
        "Below-average self-regard. May create validation-seeking patterns or difficulty trusting partner's positive regard.",
    };
  if (score >= 11)
    return {
      band: 'Low self-esteem',
      modifier: -0.4,
      description:
        'Significantly impaired self-regard. Heightened rejection sensitivity and risk of emotional dependency or withdrawal patterns.',
    };
  return {
    band: 'Floor self-esteem',
    modifier: -0.6,
    description:
      'Severe self-worth deficit. Requires therapeutic support before relationship readiness can be established.',
  };
}

function getScsBand(
  publicScore: number | null,
  privateScore: number | null,
): { band: string; modifier: number; description: string } {
  if (publicScore === null || privateScore === null)
    return { band: 'Not assessed', modifier: 0, description: '' };
  const diff = privateScore - publicScore;
  if (diff >= 4)
    return {
      band: 'Strongly internally oriented',
      modifier: 0,
      description:
        'Strong attunement to internal states over external perception. Associated with emotional authenticity and self-awareness in relationships.',
    };
  if (diff >= 1)
    return {
      band: 'Mildly internally oriented',
      modifier: 0,
      description: 'Slightly more attuned to internal experience than external impression.',
    };
  if (diff >= -1)
    return { band: 'Balanced', modifier: 0, description: 'Roughly equal attention to internal states and external perception.' };
  if (diff >= -4)
    return {
      band: 'Mildly externally oriented',
      modifier: -0.1,
      description: 'Slightly more focused on external impression than internal attunement.',
    };
  if (diff >= -6)
    return {
      band: 'Moderately externally oriented',
      modifier: -0.1,
      description:
        'Noticeable orientation toward external perception over internal states. May limit emotional authenticity.',
    };
  return {
    band: 'Strongly externally oriented',
    modifier: -0.2,
    description:
      'Strong orientation toward how others perceive them over how they actually feel. Associated with difficulty with authentic emotional intimacy.',
  };
}

export function ProfileIntentTab({ user }: { user: AdminUserProfileRecord }) {
  const leadQuality = computeLeadQuality(
    user.market_research_relationship_seriousness,
    user.market_research_search_duration,
    user.market_research_max_spend,
  );

  const consistencyFlags = asStringArray(user.psychometric_consistency_flags);
  const straightLineFlags = asStringArray(user.psychometric_straight_line_flags);
  const allFlags = [...consistencyFlags, ...straightLineFlags];

  const marketResearchComplete = !!user.market_research_completed_at;

  return (
    <ScrollView style={tabStyles.container} contentContainerStyle={tabStyles.content}>
      <Text style={tabStyles.sectionHeader}>Acquisition & Intent</Text>

      {!marketResearchComplete ? (
        <View style={tabStyles.emptyState}>
          <Text style={tabStyles.emptyStateText}>Market research not yet completed by this user.</Text>
        </View>
      ) : (
        <>
          <View style={tabStyles.leadQualityRow}>
            <Text style={tabStyles.leadQualityLabel}>Lead Quality</Text>
            <View
              style={[
                tabStyles.leadBadge,
                { backgroundColor: leadQuality.color + '22', borderColor: leadQuality.color },
              ]}
            >
              <Text style={[tabStyles.leadBadgeText, { color: leadQuality.color }]}>{leadQuality.level}</Text>
            </View>
          </View>
          <Text style={tabStyles.leadReason}>{leadQuality.reason}</Text>

          <View style={tabStyles.divider} />

          {(
            [
              {
                label: 'Referral source',
                value: user.market_research_referral_source,
                sub:
                  user.market_research_referral_source === 'Other'
                    ? user.market_research_referral_other
                    : null,
              },
              { label: 'Relationship seriousness', value: user.market_research_relationship_seriousness },
              { label: 'Search duration', value: user.market_research_search_duration },
              { label: 'Dating status', value: user.market_research_dating_status },
              { label: 'Max spend on coaching / workshops', value: user.market_research_max_spend },
            ] as const
          ).map(({ label, value, sub }) => (
            <View key={label} style={tabStyles.factRow}>
              <Text style={tabStyles.factLabel}>{label}</Text>
              <Text style={tabStyles.factValue}>{value ?? '—'}</Text>
              {sub ? <Text style={tabStyles.factSub}>{sub}</Text> : null}
            </View>
          ))}

          {user.market_research_spend_context ? (
            <View style={tabStyles.spendContextBlock}>
              <Text style={tabStyles.factLabel}>Workshop / coaching context</Text>
              <Text style={tabStyles.spendContextText}>"{user.market_research_spend_context}"</Text>
            </View>
          ) : null}
        </>
      )}

      <View style={tabStyles.sectionSpacer} />

      <Text style={tabStyles.sectionHeader}>Life Domain Answers</Text>
      <LifeDomainAnswersSection userId={user.id} />

      <View style={tabStyles.sectionSpacer} />

      <Text style={tabStyles.sectionHeader}>Assessment Consistency</Text>

      {allFlags.length === 0 ? (
        <View style={[tabStyles.flagRow, { borderColor: '#22c55e' }]}>
          <Text style={[tabStyles.flagTitle, { color: '#22c55e' }]}>✓ No consistency concerns detected</Text>
        </View>
      ) : (
        allFlags.map((flag) => {
          const description =
            CONSISTENCY_FLAG_DESCRIPTIONS[flag] ?? STRAIGHT_LINE_FLAG_DESCRIPTIONS[flag] ?? flag;
          const isStraightLine = flag.includes('straight_line');
          return (
            <View
              key={flag}
              style={[tabStyles.flagRow, { borderColor: isStraightLine ? '#f59e0b' : '#ef4444' }]}
            >
              <Text style={[tabStyles.flagTitle, { color: isStraightLine ? '#f59e0b' : '#ef4444' }]}>
                {isStraightLine ? '⚠ Response pattern flag' : '⚠ Consistency review'}
              </Text>
              <Text style={tabStyles.flagCode}>{flag}</Text>
              <Text style={tabStyles.flagDescription}>{description}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

export function FullAssessmentTab({
  attempt,
  user,
}: {
  attempt: AdminAttemptAssessmentRecord;
  user: AdminUserProfileRecord;
}) {
  const psychometricsAppliedOnAttempt = attemptHasPsychometricModifierApplied(attempt);
  const psychometricsComplete =
    !!user.psychometrics_completed_at ||
    psychometricsAppliedOnAttempt ||
    user.psychometric_modifier != null ||
    userHasStoredPsychometricScores(user);
  const psychometricsCompletionTimestampMissing =
    psychometricsAppliedOnAttempt && !user.psychometrics_completed_at;

  const interviewScore = attempt.weighted_score ?? null;
  const depthModifier = attempt.depth_signal_modifier ?? attempt.score_modifier ?? null;
  const psychometricModifier = attempt.psychometric_modifier_applied ?? null;
  const correctedPsychometricModifier = attempt.corrected_psychometric_modifier ?? psychometricModifier;
  const gamingCorrection = attempt.gaming_correction ?? null;
  const finalScore = attempt.modified_weighted_score_with_psychometrics ?? null;
  const finalPass = attempt.final_gate_pass ?? null;
  const interviewOnlyPass = attempt.passed;

  const gateDecisionChanged =
    finalPass !== null && interviewOnlyPass !== null && finalPass !== interviewOnlyPass;

  const hasScoreBreakdown = userHasStoredPsychometricScores(user);
  const breakdownUnavailable = psychometricsAppliedOnAttempt && !hasScoreBreakdown;

  const brsInfo = getBrsBand(user.psychometrics_brs_score ?? null);
  const anxietyTraitInfo = getAnxietyTraitBand(user.psychometrics_anxiety_trait_score ?? null);
  const scsSfInfo = getScsSfBand(user.psychometrics_scs_sf_score ?? null);
  const gaspInfo = getGaspBand(user.psychometrics_gasp_score ?? null);
  const dweckInfo = getDweckBand(user.psychometrics_dweck_score ?? null);
  const aaq2Info = getAaq2Band(user.psychometrics_aaq2_score ?? null);
  const rsesInfo = getRsesBand(user.psychometrics_rses_score ?? null);
  const scsInfo = getScsBand(
    user.psychometrics_scs_public_score ?? null,
    user.psychometrics_scs_private_score ?? null,
  );
  const mspssInfo = getMspssBand(user.psychometrics_mspss_friends_score ?? null);
  const sd3Info = getSd3NarcissismBand(user.psychometrics_sd3_narcissism_score ?? null);
  const rfqInfo = getRfqBand(user.psychometrics_rfq_score ?? null);
  const sexualCommInfo = sexualCommunicationBand(user.psychometrics_sexual_communication_score ?? null);
  const sexualCommComplete = !!user.psychometrics_sexual_communication_completed_at;

  const consistencyFlags = asStringArray(user.psychometric_consistency_flags);
  const straightLineFlags = asStringArray(user.psychometric_straight_line_flags);
  const gateFailReasons = asStringArray(attempt.gate_fail_reasons);
  const psychometricFloorScores = psychometricFloorScoresFromUser(user);
  const activePsychometricGateFails = gateFailReasons.filter((id) =>
    (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id),
  );
  const retroactivePsychometricFloorReviews = getRetroactivePsychometricFloorReviews(
    attempt,
    psychometricFloorScores,
    straightLineFlags,
  );

  return (
    <ScrollView style={tabStyles.container} contentContainerStyle={tabStyles.content}>
      <GamingCorrectionBanner gamingCorrection={gamingCorrection} />
      <Text style={tabStyles.sectionHeader}>Score Summary</Text>

      <View style={tabStyles.scoreTable}>
        <View style={tabStyles.scoreRow}>
          <Text style={tabStyles.scoreLabel}>Interview weighted score</Text>
          <Text style={tabStyles.scoreValue}>
            {interviewScore != null ? interviewScore.toFixed(2) : '—'}
          </Text>
        </View>
        <View style={tabStyles.scoreRow}>
          <Text style={tabStyles.scoreLabel}>Depth signal modifier</Text>
          <Text
            style={[
              tabStyles.scoreValue,
              depthModifier != null && depthModifier > 0 && { color: '#22c55e' },
              depthModifier != null && depthModifier < 0 && { color: '#ef4444' },
            ]}
          >
            {depthModifier != null ? (depthModifier >= 0 ? '+' : '') + depthModifier.toFixed(2) : '—'}
          </Text>
        </View>
        <View style={tabStyles.scoreRow}>
          <Text style={tabStyles.scoreLabel}>Psychometric modifier (raw)</Text>
          <Text
            style={[
              tabStyles.scoreValue,
              !psychometricsComplete && { color: '#999' },
              psychometricModifier != null && psychometricModifier < 0 && { color: '#ef4444' },
            ]}
          >
            {!psychometricsComplete
              ? 'Pending'
              : psychometricModifier != null
                ? psychometricModifier.toFixed(2)
                : '—'}
          </Text>
        </View>
        {psychometricsComplete && correctedPsychometricModifier != null && correctedPsychometricModifier !== psychometricModifier ? (
          <View style={tabStyles.scoreRow}>
            <Text style={tabStyles.scoreLabel}>Psychometric modifier (corrected)</Text>
            <Text
              style={[
                tabStyles.scoreValue,
                correctedPsychometricModifier < 0 && { color: '#ef4444' },
              ]}
            >
              {correctedPsychometricModifier.toFixed(2)}
            </Text>
          </View>
        ) : null}
        <View style={[tabStyles.scoreRow, tabStyles.scoreRowTotal]}>
          <Text style={tabStyles.scoreLabelTotal}>Final modified score</Text>
          <Text style={tabStyles.scoreValueTotal}>
            {!psychometricsComplete
              ? `${((interviewScore ?? 0) + (depthModifier ?? 0)).toFixed(2)} (no psychometrics yet)`
              : finalScore != null
                ? finalScore.toFixed(2)
                : '—'}
          </Text>
        </View>
      </View>

      <View style={tabStyles.gateDecisionRow}>
        <Text style={tabStyles.gateDecisionLabel}>Final gate decision</Text>
        {!psychometricsComplete ? (
          <View style={[tabStyles.gateBadge, { backgroundColor: '#f5f5f5', borderColor: '#ccc' }]}>
            <Text style={[tabStyles.gateBadgeText, { color: '#999' }]}>PENDING PSYCHOMETRICS</Text>
          </View>
        ) : finalPass === true ? (
          <View style={[tabStyles.gateBadge, { backgroundColor: '#f0fdf4', borderColor: '#22c55e' }]}>
            <Text style={[tabStyles.gateBadgeText, { color: '#22c55e' }]}>PASS</Text>
          </View>
        ) : (
          <View style={[tabStyles.gateBadge, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}>
            <Text style={[tabStyles.gateBadgeText, { color: '#ef4444' }]}>FAIL</Text>
          </View>
        )}
      </View>

      {gateDecisionChanged ? (
        <View style={tabStyles.gateChangedBanner}>
          <Text style={tabStyles.gateChangedText}>
            ⚠ Gate decision changed after psychometrics — interview {interviewOnlyPass ? 'passed' : 'failed'}{' '}
            but final result {finalPass ? 'passed' : 'failed'}
          </Text>
        </View>
      ) : null}

      {activePsychometricGateFails.map((floorId) => {
        const score = psychometricFloorScoreForUser(floorId, psychometricFloorScores);
        if (score == null || !Number.isFinite(score)) return null;
        return (
          <View key={floorId} style={[tabStyles.flagRow, { borderColor: '#ef4444', marginTop: 8 }]}>
            <Text style={[tabStyles.flagTitle, { color: '#ef4444' }]}>⛔ Gate fail — {floorId}</Text>
            <Text style={tabStyles.flagCode}>{floorId}</Text>
            <Text style={tabStyles.flagDescription}>{formatPsychometricGateFailDescription(floorId, score)}</Text>
          </View>
        );
      })}

      {retroactivePsychometricFloorReviews.map((review) => (
        <View key={review.id} style={[tabStyles.flagRow, { borderColor: '#D4A84B', marginTop: 8 }]}>
          <Text style={[tabStyles.flagTitle, { color: '#D4A84B' }]}>⚠ Retroactive floor review — {review.id}</Text>
          <Text style={tabStyles.flagDescription}>{review.retroactiveNote}</Text>
          <Text style={[tabStyles.flagDescription, { marginTop: 4 }]}>{review.description}</Text>
        </View>
      ))}

      {psychometricsCompletionTimestampMissing ? (
        <View style={tabStyles.pendingBanner}>
          <Text style={tabStyles.pendingBannerText}>
            Psychometric modifier is stored on this attempt, but users.psychometrics_completed_at is missing —
            instrument breakdown may be incomplete until the profile row is synced.
          </Text>
        </View>
      ) : null}

      {breakdownUnavailable ? (
        <View style={tabStyles.gateChangedBanner}>
          <Text style={tabStyles.gateChangedText}>
            The psychometric modifier ({psychometricModifier?.toFixed(2) ?? '—'}) on this attempt is stored, but individual test scores are not
            loading for this user in admin. Open the browser console for [Admin] fetchAdminUserProfile errors, confirm
            you are signed in as admin@amoraea.com, and run the psychometrics query on users for id {user.id}. If scores
            are null in Supabase, they were never saved or were cleared after scoring — retaking Part 1 psychometrics
            and re-applying the modifier will fix the breakdown.
            {user.psychometric_modifier != null
              ? ` users.psychometric_modifier: ${user.psychometric_modifier.toFixed(2)}.`
              : ''}
          </Text>
        </View>
      ) : null}

      {!psychometricsComplete ? (
        <View style={tabStyles.pendingBanner}>
          <Text style={tabStyles.pendingBannerText}>
            Psychometric assessments not yet completed. Score summary shows interview and depth signal
            modifiers only.
          </Text>
        </View>
      ) : null}

      <View style={tabStyles.sectionSpacer} />

      {hasScoreBreakdown ? (
        <>
          <Text style={tabStyles.sectionHeader}>Psychometric Scores</Text>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Resilience Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  brsInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {brsInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Score: {user.psychometrics_brs_score ?? '—'}/5.0 — {brsInfo.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{brsInfo.description}</Text>
            {wouldTriggerBrsLowResilienceFloor(user.psychometrics_brs_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {BRS_LOW_RESILIENCE_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('brs_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.brs_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Emotional Patterns Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  anxietyTraitInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {anxietyTraitInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Score: {user.psychometrics_anxiety_trait_score ?? '—'}/5.0 — {anxietyTraitInfo.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{anxietyTraitInfo.description}</Text>
            {wouldTriggerAnxietyTraitHighFloor(
              user.psychometrics_anxiety_trait_score,
              straightLineFlags,
            ) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {ANXIETY_TRAIT_HIGH_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('anxiety_trait_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.anxiety_trait_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Self-Compassion Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  scsSfInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {scsSfInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Score: {user.psychometrics_scs_sf_score ?? '—'}/5.0 — {scsSfInfo.band}
            </Text>
            <View style={tabStyles.scsSubscaleRow}>
              <Text style={tabStyles.scsSubscale}>
                Kindness: {user.psychometrics_scs_sf_self_kindness_score ?? '—'}
              </Text>
              <Text style={tabStyles.scsSubscale}>
                Humanity: {user.psychometrics_scs_sf_common_humanity_score ?? '—'}
              </Text>
              <Text style={tabStyles.scsSubscale}>
                Mindfulness: {user.psychometrics_scs_sf_mindfulness_score ?? '—'}
              </Text>
            </View>
            <Text style={tabStyles.instrumentDescription}>{scsSfInfo.description}</Text>
            {wouldTriggerScsSfLowSelfCompassionFloor(
              user.psychometrics_scs_sf_score,
              straightLineFlags,
            ) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('scs_sf_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.scs_sf_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Responsibility Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  gaspInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {gaspInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Externalization: {user.psychometrics_gasp_score ?? '—'}/7.0 — {gaspInfo.band}
            </Text>
            <View style={tabStyles.scsSubscaleRow}>
              <Text style={tabStyles.scsSubscale}>
                Guilt–Repair: {user.psychometrics_gasp_guilt_repair_score ?? '—'}/7.0
              </Text>
              <Text style={tabStyles.scsSubscale}>
                Shame–Withdraw: {user.psychometrics_gasp_shame_withdraw_score ?? '—'}/7.0
              </Text>
            </View>
            <Text style={tabStyles.instrumentDescription}>{gaspInfo.description}</Text>
            {wouldTriggerGaspExtremeExternalizationFloor(user.psychometrics_gasp_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('gasp_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.gasp_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Relationship Beliefs Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  dweckInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {dweckInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Mean: {user.psychometrics_dweck_score ?? '—'}/6.0 — {dweckInfo.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{dweckInfo.description}</Text>
            {wouldTriggerDweckExtremeFixedMindsetFloor(user.psychometrics_dweck_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('dweck_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.dweck_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Emotional Flexibility Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  aaq2Info.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {aaq2Info.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Score: {user.psychometrics_aaq2_score ?? '—'}/49 — {aaq2Info.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{aaq2Info.description}</Text>
            {wouldTriggerAaq2HighExperientialAvoidanceFloor(
              user.psychometrics_aaq2_score,
              straightLineFlags,
            ) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('aaq2_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.aaq2_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Self-Esteem Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  rsesInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {rsesInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Score: {user.psychometrics_rses_score ?? '—'}/40 — {rsesInfo.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{rsesInfo.description}</Text>
            {wouldTriggerRsesLowSelfEsteemFloor(user.psychometrics_rses_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {RSES_LOW_SELF_ESTEEM_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('rses_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.rses_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Self-Awareness Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  scsInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {scsInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <View style={tabStyles.scsSubscaleRow}>
              <Text style={tabStyles.scsSubscale}>
                Public: {user.psychometrics_scs_public_score ?? '—'}/21
              </Text>
              <Text style={tabStyles.scsSubscale}>
                Private: {user.psychometrics_scs_private_score ?? '—'}/18
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>{scsInfo.band}</Text>
            <Text style={tabStyles.instrumentDescription}>{scsInfo.description}</Text>
            {wouldTriggerScsLowPrivateSelfAwarenessFloor(
              user.psychometrics_scs_public_score,
              user.psychometrics_scs_private_score,
              straightLineFlags,
            ) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('scs_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.scs_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Social Support Assessment</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  mspssInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {mspssInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Friends: {user.psychometrics_mspss_friends_score ?? '—'}/7.0 — {mspssInfo.band}
            </Text>
            <View style={tabStyles.scsSubscaleRow}>
              <Text style={tabStyles.scsSubscale}>
                Family: {user.psychometrics_mspss_family_score ?? '—'}/7.0
              </Text>
              <Text style={tabStyles.scsSubscale}>
                Total: {user.psychometrics_mspss_score ?? '—'}/7.0
              </Text>
            </View>
            <Text style={tabStyles.instrumentDescription}>{mspssInfo.description}</Text>
            {straightLineFlags.includes('mspss_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.mspss_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Social Perceptions Assessment (SD3 Narcissism)</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  sd3Info.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {sd3Info.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Mean narcissism: {user.psychometrics_sd3_narcissism_score ?? '—'}/5.0 — {sd3Info.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{sd3Info.description}</Text>
            {wouldTriggerSd3NarcissismFloor(user.psychometrics_sd3_narcissism_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {SD3_NARCISSISM_FLOOR_FAIL_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes('sd3_narcissism_straight_line') ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.sd3_narcissism_straight_line}
              </Text>
            ) : null}
          </View>

          <View style={tabStyles.instrumentCard}>
            <View style={tabStyles.instrumentHeader}>
              <Text style={tabStyles.instrumentName}>Self-Reflection Assessment (RFQ)</Text>
              <Text
                style={[
                  tabStyles.instrumentModifier,
                  rfqInfo.modifier < 0 && { color: '#ef4444' },
                ]}
              >
                {rfqInfo.modifier.toFixed(2)}
              </Text>
            </View>
            <Text style={tabStyles.instrumentScore}>
              Mean: {user.psychometrics_rfq_score ?? '—'}/7.0 — {rfqInfo.band}
            </Text>
            <Text style={tabStyles.instrumentDescription}>{rfqInfo.description}</Text>
            {wouldTriggerRfqLowReflectiveFunctioningFloor(user.psychometrics_rfq_score, straightLineFlags) ? (
              <Text style={tabStyles.floorWarning}>
                ⛔ Floor breach — {RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE} gate fail triggered
              </Text>
            ) : null}
            {straightLineFlags.includes(RFQ_STRAIGHT_LINE_FLAG) ? (
              <Text style={tabStyles.straightLineWarning}>
                ⚠ {STRAIGHT_LINE_FLAG_DESCRIPTIONS.rfq_straight_line}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      {psychometricsComplete ? (
        <GamingCorrectionCard
          gamingCorrection={gamingCorrection}
          instrumentComponents={{
            gasp: gaspInfo.modifier,
            brs: brsInfo.modifier,
            anxiety_trait: anxietyTraitInfo.modifier,
            aaq2: aaq2Info.modifier,
            rfq: rfqInfo.modifier,
            mspss: mspssInfo.modifier,
            sd3_narcissism: sd3Info.modifier,
            dweck: dweckInfo.modifier,
            rses: rsesInfo.modifier,
            scs_sf: scsSfInfo.modifier,
            scs: scsInfo.modifier,
          }}
        />
      ) : null}

      <View style={tabStyles.sectionSpacer} />
      <Text style={tabStyles.sectionHeader}>Post-Interview Assessments</Text>

      {!sexualCommComplete ? (
        <View style={tabStyles.emptyState}>
          <Text style={tabStyles.emptyStateText}>Sexual Communication not yet completed.</Text>
        </View>
      ) : (
        <View style={tabStyles.instrumentCard}>
          <View style={tabStyles.instrumentHeader}>
            <Text style={tabStyles.instrumentName}>Sexual Communication</Text>
            <Text style={tabStyles.instrumentModifier}>Matching signal</Text>
          </View>
          <Text style={tabStyles.instrumentScore}>
            Mean: {user.psychometrics_sexual_communication_score ?? '—'}/5.0 — {sexualCommInfo.band}
          </Text>
          <Text style={tabStyles.instrumentDescription}>
            Completed{' '}
            {formatSexualCommunicationCompletedAt(user.psychometrics_sexual_communication_completed_at) ||
              '—'}
          </Text>
          <Text style={tabStyles.instrumentDescription}>
            Pairs within 0.5 points receive a soft compatibility boost; gaps above 1.5 points receive a soft
            penalty.
          </Text>
        </View>
      )}

      <View style={tabStyles.sectionSpacer} />

      {hasScoreBreakdown || consistencyFlags.length > 0 || straightLineFlags.length > 0 ? (
        <>
          <Text style={tabStyles.sectionHeader}>Consistency Analysis</Text>

          {consistencyFlags.length === 0 && straightLineFlags.length === 0 ? (
            <View style={[tabStyles.flagRow, { borderColor: '#22c55e' }]}>
              <Text style={[tabStyles.flagTitle, { color: '#22c55e' }]}>
                ✓ Self-report and behavioral signals are consistent
              </Text>
            </View>
          ) : null}
          {consistencyFlags.map((flag) => {
            const description = CONSISTENCY_FLAG_DESCRIPTIONS[flag] ?? flag;
            return (
              <View key={flag} style={[tabStyles.flagRow, { borderColor: '#f59e0b' }]}>
                <Text style={[tabStyles.flagTitle, { color: '#f59e0b' }]}>
                  ⚠ Consistency review required
                </Text>
                <Text style={tabStyles.flagCode}>{flag}</Text>
                <Text style={tabStyles.flagDescription}>{description}</Text>
              </View>
            );
          })}
          {straightLineFlags.map((flag) => {
            const description = STRAIGHT_LINE_FLAG_DESCRIPTIONS[flag] ?? flag;
            return (
              <View key={flag} style={[tabStyles.flagRow, { borderColor: '#f59e0b' }]}>
                <Text style={[tabStyles.flagTitle, { color: '#f59e0b' }]}>⚠ Straight-line responding</Text>
                <Text style={tabStyles.flagCode}>{flag}</Text>
                <Text style={tabStyles.flagDescription}>{description}</Text>
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionSpacer: { height: 28 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 16 },
  emptyState: {
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  emptyStateText: { fontSize: 13, color: '#666', textAlign: 'center' },
  leadQualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  leadQualityLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  leadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  leadBadgeText: { fontSize: 12, fontWeight: '700' },
  leadReason: { fontSize: 12, color: '#888', marginBottom: 4 },
  factRow: { marginBottom: 12 },
  factLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  factValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  factSub: { fontSize: 12, color: '#888', marginTop: 2 },
  spendContextBlock: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  spendContextText: { fontSize: 13, color: '#ccc', fontStyle: 'italic', marginTop: 4 },
  flagRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    backgroundColor: '#111',
    marginBottom: 8,
  },
  flagTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  flagCode: { fontSize: 11, color: '#666', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  flagDescription: { fontSize: 12, color: '#aaa', lineHeight: 17 },
  scoreTable: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  scoreRowTotal: {
    backgroundColor: '#161616',
    borderBottomWidth: 0,
  },
  scoreLabel: { fontSize: 13, color: '#aaa' },
  scoreValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  scoreLabelTotal: { fontSize: 14, color: '#fff', fontWeight: '600' },
  scoreValueTotal: { fontSize: 16, color: '#fff', fontWeight: '700' },
  gateDecisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gateDecisionLabel: { fontSize: 13, color: '#aaa' },
  gateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  gateBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  gateChangedBanner: {
    padding: 10,
    backgroundColor: '#1a1200',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 8,
  },
  gateChangedText: { fontSize: 12, color: '#f59e0b', lineHeight: 17 },
  pendingBanner: {
    padding: 10,
    backgroundColor: '#111',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  pendingBannerText: { fontSize: 12, color: '#666', lineHeight: 17 },
  instrumentCard: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    marginBottom: 10,
  },
  instrumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  instrumentName: { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  instrumentModifier: { fontSize: 16, fontWeight: '700' },
  instrumentScore: { fontSize: 13, color: '#ccc', marginBottom: 4 },
  instrumentDescription: { fontSize: 12, color: '#888', lineHeight: 17 },
  scsSubscaleRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  scsSubscale: { fontSize: 13, color: '#ccc' },
  straightLineWarning: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 6,
    lineHeight: 16,
  },
  floorWarning: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 6,
    lineHeight: 16,
  },
});
