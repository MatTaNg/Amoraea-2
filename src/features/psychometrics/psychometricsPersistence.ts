import { supabase } from '@data/supabase/client';
import {
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  scoreAssessment,
  splitScsResponses,
  type AssessmentId,
} from './assessmentContent';
import {
  isMissingUsersPsychometricsSd3ColumnsError,
  sd3NarcissismLegacyNarqSavePayload,
  sd3NarcissismPrimarySavePayload,
  sd3NarcissismResponsesFromUserRow,
} from './usersPsychometricsSchemaFallback';

export type PsychometricSaveResult =
  | { ok: true }
  | { ok: false; message: string };

export type PsychometricResponsesRow = {
  psychometrics_brs_responses?: unknown;
  psychometrics_anxiety_trait_responses?: unknown;
  psychometrics_scs_sf_responses?: unknown;
  psychometrics_gasp_responses?: unknown;
  psychometrics_dweck_responses?: unknown;
  psychometrics_aaq2_responses?: unknown;
  psychometrics_rses_responses?: unknown;
  psychometrics_scs_public_responses?: unknown;
  psychometrics_scs_private_responses?: unknown;
  psychometrics_mspss_responses?: unknown;
  psychometrics_sd3_narcissism_responses?: unknown;
  psychometrics_narq_s_responses?: unknown;
  psychometrics_rfq_responses?: unknown;
};

const PSYCHOMETRICS_RESPONSES_SELECT = `
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_responses,
  psychometrics_dweck_responses,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_responses,
  psychometrics_scs_private_responses,
  psychometrics_mspss_responses,
  psychometrics_sd3_narcissism_responses,
  psychometrics_narq_s_responses,
  psychometrics_rfq_responses
`;

/** When 20260628140000_users_psychometrics_sd3_narcissism.sql is not applied yet. */
const PSYCHOMETRICS_RESPONSES_SELECT_LEGACY_SD3 = `
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_responses,
  psychometrics_dweck_responses,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_responses,
  psychometrics_scs_private_responses,
  psychometrics_mspss_responses,
  psychometrics_narq_s_responses,
  psychometrics_rfq_responses
`;

function hasStoredResponses(value: unknown): boolean {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/** Pure check: which pre-interview instruments lack persisted response JSON on the user row. */
export function getMissingPsychometricAssessments(row: PsychometricResponsesRow): AssessmentId[] {
  const missing: AssessmentId[] = [];
  for (const assessmentId of ASSESSMENT_ORDER) {
    if (!isAssessmentPersisted(assessmentId, row)) {
      missing.push(assessmentId);
    }
  }
  return missing;
}

function isAssessmentPersisted(assessmentId: AssessmentId, row: PsychometricResponsesRow): boolean {
  switch (assessmentId) {
    case 'scs':
      return (
        hasStoredResponses(row.psychometrics_scs_public_responses) &&
        hasStoredResponses(row.psychometrics_scs_private_responses)
      );
    case 'brs':
      return hasStoredResponses(row.psychometrics_brs_responses);
    case 'anxiety_trait':
      return hasStoredResponses(row.psychometrics_anxiety_trait_responses);
    case 'scs_sf':
      return hasStoredResponses(row.psychometrics_scs_sf_responses);
    case 'gasp':
      return hasStoredResponses(row.psychometrics_gasp_responses);
    case 'dweck':
      return hasStoredResponses(row.psychometrics_dweck_responses);
    case 'aaq2':
      return hasStoredResponses(row.psychometrics_aaq2_responses);
    case 'rses':
      return hasStoredResponses(row.psychometrics_rses_responses);
    case 'mspss':
      return hasStoredResponses(row.psychometrics_mspss_responses);
    case 'sd3_narcissism':
      return hasStoredResponses(sd3NarcissismResponsesFromUserRow(row as Record<string, unknown>));
    case 'rfq':
      return hasStoredResponses(row.psychometrics_rfq_responses);
    default:
      return false;
  }
}

export function formatMissingPsychometricAssessmentNames(missing: AssessmentId[]): string {
  return missing.map((id) => ASSESSMENTS[id].name).join(', ');
}

export function buildAssessmentSavePayload(
  assessmentId: AssessmentId,
  finalResponses: Record<number, number>,
): Record<string, unknown> {
  const scores = scoreAssessment(assessmentId, finalResponses);
  const updatePayload: Record<string, unknown> = {};

  if (assessmentId === 'scs') {
    const split = splitScsResponses(finalResponses);
    updatePayload.psychometrics_scs_public_responses = split.public;
    updatePayload.psychometrics_scs_private_responses = split.private;
    updatePayload.psychometrics_scs_public_score = scores.public;
    updatePayload.psychometrics_scs_private_score = scores.private;
  } else if (assessmentId === 'scs_sf') {
    updatePayload.psychometrics_scs_sf_responses = finalResponses;
    updatePayload.psychometrics_scs_sf_score = scores.total;
    updatePayload.psychometrics_scs_sf_self_kindness_score = scores.self_kindness;
    updatePayload.psychometrics_scs_sf_common_humanity_score = scores.common_humanity;
    updatePayload.psychometrics_scs_sf_mindfulness_score = scores.mindfulness;
  } else if (assessmentId === 'mspss') {
    updatePayload.psychometrics_mspss_responses = finalResponses;
    updatePayload.psychometrics_mspss_score = scores.total;
    updatePayload.psychometrics_mspss_family_score = scores.family;
    updatePayload.psychometrics_mspss_friends_score = scores.friends;
  } else if (assessmentId === 'dweck') {
    updatePayload.psychometrics_dweck_responses = finalResponses;
    updatePayload.psychometrics_dweck_score = scores.total;
    updatePayload.psychometrics_dweck_growth_score = scores.growth;
    updatePayload.psychometrics_dweck_rbi_disagreement_score = scores.rbi_disagreement;
  } else if (assessmentId === 'gasp') {
    updatePayload.psychometrics_gasp_responses = finalResponses;
    updatePayload.psychometrics_gasp_score = scores.total;
    updatePayload.psychometrics_gasp_guilt_repair_score = scores.guilt_repair;
    updatePayload.psychometrics_gasp_shame_withdraw_score = scores.shame_withdraw;
  } else if (assessmentId === 'sd3_narcissism') {
    Object.assign(
      updatePayload,
      sd3NarcissismPrimarySavePayload(finalResponses, scores.total as number),
    );
  } else {
    updatePayload[`psychometrics_${assessmentId}_responses`] = finalResponses;
    updatePayload[`psychometrics_${assessmentId}_score`] = scores.total;
  }

  return updatePayload;
}

export async function loadPsychometricAssessmentResponses(
  userId: string,
  assessmentId: AssessmentId,
): Promise<Record<number, number>> {
  if (assessmentId === 'scs') {
    const { data } = await supabase
      .from('users')
      .select('psychometrics_scs_public_responses, psychometrics_scs_private_responses')
      .eq('id', userId)
      .single();
    if (!data) return {};
    return mergeScsResponses(
      data.psychometrics_scs_public_responses as Record<number, number> | null,
      data.psychometrics_scs_private_responses as Record<number, number> | null,
    );
  }

  if (assessmentId === 'sd3_narcissism') {
    let { data, error } = await supabase
      .from('users')
      .select('psychometrics_sd3_narcissism_responses, psychometrics_narq_s_responses')
      .eq('id', userId)
      .single();
    if (error && isMissingUsersPsychometricsSd3ColumnsError(error)) {
      const legacy = await supabase
        .from('users')
        .select('psychometrics_narq_s_responses')
        .eq('id', userId)
        .single();
      data = legacy.data;
    }
    if (!data) return {};
    const raw = sd3NarcissismResponsesFromUserRow(data as Record<string, unknown>);
    return (raw as Record<number, number> | null) ?? {};
  }

  const column = `psychometrics_${assessmentId}_responses`;
  const { data } = await supabase.from('users').select(column).eq('id', userId).single();
  if (!data) return {};
  return ((data as Record<string, unknown>)[column] as Record<number, number> | null) ?? {};
}

export async function savePsychometricAssessmentResult(
  userId: string,
  assessmentId: AssessmentId,
  finalResponses: Record<number, number>,
): Promise<PsychometricSaveResult> {
  const updatePayload = buildAssessmentSavePayload(assessmentId, finalResponses);
  let { error } = await supabase.from('users').update(updatePayload).eq('id', userId);

  if (
    error &&
    assessmentId === 'sd3_narcissism' &&
    isMissingUsersPsychometricsSd3ColumnsError(error)
  ) {
    const scores = scoreAssessment(assessmentId, finalResponses);
    const legacyPayload = sd3NarcissismLegacyNarqSavePayload(
      finalResponses,
      scores.total as number,
    );
    console.warn(
      '[Psychometrics] SD3 columns missing — saving Narcissism Assessment to legacy psychometrics_narq_s_* columns',
    );
    ({ error } = await supabase.from('users').update(legacyPayload).eq('id', userId));
  }

  if (error) {
    console.error('[Psychometrics] saveAssessmentResult failed:', assessmentId, error);
    return {
      ok: false,
      message:
        error.message ??
        `Could not save ${ASSESSMENTS[assessmentId].name}. Check your connection and try again.`,
    };
  }

  return { ok: true };
}

export async function persistPsychometricProgress(
  userId: string,
  assessmentId: AssessmentId,
  questionIndex: number,
  currentResponses: Record<number, number>,
): Promise<PsychometricSaveResult> {
  const { error } = await supabase
    .from('users')
    .update({
      psychometrics_current_assessment: assessmentId,
      psychometrics_current_question_index: questionIndex,
      psychometrics_partial_responses: currentResponses,
    })
    .eq('id', userId);

  if (error) {
    console.error('[Psychometrics] persistProgress failed:', error);
    return { ok: false, message: error.message ?? 'Could not save progress.' };
  }

  return { ok: true };
}

export async function verifyAllPsychometricsPersisted(userId: string): Promise<{
  complete: boolean;
  missingAssessmentIds: AssessmentId[];
}> {
  let { data, error } = await supabase
    .from('users')
    .select(PSYCHOMETRICS_RESPONSES_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error && isMissingUsersPsychometricsSd3ColumnsError(error)) {
    const legacy = await supabase
      .from('users')
      .select(PSYCHOMETRICS_RESPONSES_SELECT_LEGACY_SD3)
      .eq('id', userId)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error('[Psychometrics] verifyAllPersisted select failed:', error);
    return { complete: false, missingAssessmentIds: [...ASSESSMENT_ORDER] };
  }

  if (!data) {
    return { complete: false, missingAssessmentIds: [...ASSESSMENT_ORDER] };
  }

  const missingAssessmentIds = getMissingPsychometricAssessments(data as PsychometricResponsesRow);
  return { complete: missingAssessmentIds.length === 0, missingAssessmentIds };
}

export async function clearPsychometricsCompleted(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({
      psychometrics_completed_at: null,
    })
    .eq('id', userId);
}

export async function markPsychometricsCompleted(userId: string): Promise<PsychometricSaveResult> {
  const { error } = await supabase
    .from('users')
    .update({
      psychometrics_completed_at: new Date().toISOString(),
      psychometrics_current_assessment: null,
      psychometrics_current_question_index: null,
      psychometrics_partial_responses: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[Psychometrics] markCompleted failed:', error);
    return { ok: false, message: error.message ?? 'Could not mark psychometrics complete.' };
  }

  return { ok: true };
}
