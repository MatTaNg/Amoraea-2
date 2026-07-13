import { supabase } from '@data/supabase/client';
import {
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  POST_INTERVIEW_ASSESSMENT_ORDER,
  scoreAssessment,
  type AssessmentId,
  type NpiEntitlementResponse,
  type PostInterviewAssessmentId,
  type PsychometricResponsesMap,
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
  psychometrics_npi_entitlement_responses?: unknown;
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
  psychometrics_npi_entitlement_responses,
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
  psychometrics_npi_entitlement_responses,
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
    case 'sd3_narcissism':
      return hasStoredResponses(sd3NarcissismResponsesFromUserRow(row as Record<string, unknown>));
    case 'npi_entitlement':
      return hasStoredResponses(row.psychometrics_npi_entitlement_responses);
    case 'rfq':
      return hasStoredResponses(row.psychometrics_rfq_responses);
    default:
      return false;
  }
}

export function formatMissingPsychometricAssessmentNames(missing: AssessmentId[]): string {
  return missing.map((id) => ASSESSMENTS[id].name).join(', ');
}

export function saveNpiEntitlementResult(
  responses: Record<number, NpiEntitlementResponse>,
  score: number,
): Record<string, unknown> {
  return {
    psychometrics_npi_entitlement_responses: responses,
    psychometrics_npi_entitlement_score: score,
  };
}

export function buildAssessmentSavePayload(
  assessmentId: AssessmentId,
  finalResponses: PsychometricResponsesMap,
): Record<string, unknown> {
  const scores = scoreAssessment(assessmentId, finalResponses);
  const updatePayload: Record<string, unknown> = {};

  if (assessmentId === 'scs_sf') {
    updatePayload.psychometrics_scs_sf_responses = finalResponses;
    updatePayload.psychometrics_scs_sf_score = scores.total;
    updatePayload.psychometrics_scs_sf_self_kindness_score = scores.self_kindness;
    updatePayload.psychometrics_scs_sf_common_humanity_score = scores.common_humanity;
    updatePayload.psychometrics_scs_sf_mindfulness_score = scores.mindfulness;
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
      sd3NarcissismPrimarySavePayload(
        finalResponses as Record<number, number>,
        scores.total as number,
      ),
    );
  } else if (assessmentId === 'npi_entitlement') {
    Object.assign(
      updatePayload,
      saveNpiEntitlementResult(
        finalResponses as Record<number, NpiEntitlementResponse>,
        scores.total as number,
      ),
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
): Promise<PsychometricResponsesMap> {
  if (assessmentId === 'npi_entitlement') {
    const { data } = await supabase
      .from('users')
      .select('psychometrics_npi_entitlement_responses')
      .eq('id', userId)
      .single();
    if (!data) return {};
    return (
      (data.psychometrics_npi_entitlement_responses as PsychometricResponsesMap | null) ?? {}
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
  finalResponses: PsychometricResponsesMap,
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
  currentResponses: PsychometricResponsesMap,
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

export type PsychometricResponsesBundle = {
  assessments: Partial<Record<AssessmentId, PsychometricResponsesMap>>;
  postInterview: Partial<Record<PostInterviewAssessmentId, Record<number, number>>>;
};

function normalizePsychometricResponseMap(raw: unknown): Record<number, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(id) && Number.isFinite(num)) out[id] = num;
  }
  return out;
}

function isRecoverablePsychometricsSelectError(error: {
  code?: string | number;
  message?: string;
} | null): boolean {
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

function normalizeNpiEntitlementResponseMap(raw: unknown): Record<number, NpiEntitlementResponse> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<number, NpiEntitlementResponse> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    if (!Number.isFinite(id) || value == null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const selectedOptionIndex = (value as { selectedOptionIndex?: unknown }).selectedOptionIndex;
    const wasEntitlement = (value as { wasEntitlement?: unknown }).wasEntitlement;
    if (
      (selectedOptionIndex === 0 || selectedOptionIndex === 1) &&
      typeof wasEntitlement === 'boolean'
    ) {
      out[id] = { selectedOptionIndex, wasEntitlement };
    }
  }
  return out;
}

function psychometricResponsesBundleFromRow(
  row: Record<string, unknown>,
): PsychometricResponsesBundle {
  const assessments: Partial<Record<AssessmentId, Record<number, number>>> = {};
  for (const assessmentId of ASSESSMENT_ORDER) {
    if (assessmentId === 'sd3_narcissism') {
      const merged = normalizePsychometricResponseMap(sd3NarcissismResponsesFromUserRow(row));
      if (Object.keys(merged).length > 0) assessments.sd3_narcissism = merged;
      continue;
    }
    if (assessmentId === 'npi_entitlement') {
      const merged = normalizeNpiEntitlementResponseMap(row.psychometrics_npi_entitlement_responses);
      if (Object.keys(merged).length > 0) assessments.npi_entitlement = merged;
      continue;
    }
    const column = `psychometrics_${assessmentId}_responses`;
    const normalized = normalizePsychometricResponseMap(row[column]);
    if (Object.keys(normalized).length > 0) {
      assessments[assessmentId] = normalized;
    }
  }

  const postInterview: Partial<Record<PostInterviewAssessmentId, Record<number, number>>> = {};
  const sexual = normalizePsychometricResponseMap(row.psychometrics_sexual_communication_responses);
  if (Object.keys(sexual).length > 0) postInterview.sexual_communication = sexual;

  return { assessments, postInterview };
}

/** Item-level psychometric responses for admin review. */
export async function fetchPsychometricResponsesBundle(
  userId: string,
): Promise<PsychometricResponsesBundle | null> {
  const selectVariants = [
    `${PSYCHOMETRICS_RESPONSES_SELECT}, psychometrics_sexual_communication_responses`,
    PSYCHOMETRICS_RESPONSES_SELECT,
    `${PSYCHOMETRICS_RESPONSES_SELECT_LEGACY_SD3}, psychometrics_sexual_communication_responses`,
    PSYCHOMETRICS_RESPONSES_SELECT_LEGACY_SD3,
  ];

  let lastError: { message?: string; code?: string | number } | null = null;
  for (const select of selectVariants) {
    const result = await supabase.from('users').select(select).eq('id', userId).maybeSingle();
    if (!result.error && result.data) {
      return psychometricResponsesBundleFromRow(result.data as Record<string, unknown>);
    }
    lastError = result.error;
    if (result.error && !isRecoverablePsychometricsSelectError(result.error)) {
      break;
    }
  }

  if (lastError) {
    console.error('[Psychometrics] fetchPsychometricResponsesBundle:', lastError);
  }
  return null;
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
