import { supabase } from '@data/supabase/client';
import type {
  RelationshipValidationCompatibilityBreakdown,
  RelationshipValidationPostAssessment,
  RelationshipValidationPreAssessment,
} from './constants';

export type RelationshipValidationComparison = {
  id: string;
  user_id: string;
  partner_email_entered: string;
  partner_user_id: string | null;
  pair_confirmed_at: string | null;
  pre_assessment: RelationshipValidationPreAssessment | null;
  post_assessment: RelationshipValidationPostAssessment | null;
  compatibility_score: number | null;
  compatibility_breakdown: RelationshipValidationCompatibilityBreakdown | null;
  profile_report_markdown: string | null;
  profile_report_source_hash: string | null;
  profile_report_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

/** User-level validation record merged with the active partner comparison. */
export type RelationshipValidationRecord = {
  user_id: string;
  active_comparison_id: string | null;
  partner_email_entered: string | null;
  partner_user_id: string | null;
  pair_confirmed_at: string | null;
  welcome_completed_at: string | null;
  pre_assessment: RelationshipValidationPreAssessment | null;
  post_assessment: RelationshipValidationPostAssessment | null;
  psychometrics_completed_at: string | null;
  compatibility_score: number | null;
  compatibility_breakdown: RelationshipValidationCompatibilityBreakdown | null;
  profile_report_markdown: string | null;
  profile_report_source_hash: string | null;
  profile_report_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

type BaseValidationRecord = {
  user_id: string;
  active_comparison_id: string | null;
  welcome_completed_at: string | null;
  psychometrics_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizePartnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mergeRecordWithComparison(
  base: BaseValidationRecord,
  comparison: RelationshipValidationComparison | null,
): RelationshipValidationRecord {
  return {
    user_id: base.user_id,
    active_comparison_id: comparison?.id ?? base.active_comparison_id,
    welcome_completed_at: base.welcome_completed_at,
    psychometrics_completed_at: base.psychometrics_completed_at,
    created_at: base.created_at,
    updated_at: comparison?.updated_at ?? base.updated_at,
    partner_email_entered: comparison?.partner_email_entered ?? null,
    partner_user_id: comparison?.partner_user_id ?? null,
    pair_confirmed_at: comparison?.pair_confirmed_at ?? null,
    pre_assessment: comparison?.pre_assessment ?? null,
    post_assessment: comparison?.post_assessment ?? null,
    compatibility_score: comparison?.compatibility_score ?? null,
    compatibility_breakdown: comparison?.compatibility_breakdown ?? null,
    profile_report_markdown: comparison?.profile_report_markdown ?? null,
    profile_report_source_hash: comparison?.profile_report_source_hash ?? null,
    profile_report_generated_at: comparison?.profile_report_generated_at ?? null,
  };
}

async function fetchBaseValidationRecord(userId: string): Promise<BaseValidationRecord | null> {
  const { data, error } = await supabase
    .from('relationship_validation_records')
    .select(
      'user_id, active_comparison_id, welcome_completed_at, psychometrics_completed_at, created_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BaseValidationRecord | null) ?? null;
}

export async function fetchValidationComparison(
  comparisonId: string,
): Promise<RelationshipValidationComparison | null> {
  const { data, error } = await supabase
    .from('relationship_validation_comparisons')
    .select('*')
    .eq('id', comparisonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RelationshipValidationComparison | null) ?? null;
}

export async function listValidationComparisons(
  userId: string,
): Promise<RelationshipValidationComparison[]> {
  await backfillLegacyComparisonIfNeeded(userId);
  const { data, error } = await supabase
    .from('relationship_validation_comparisons')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as RelationshipValidationComparison[]) ?? [];
}

/** Backfill legacy single-row partner data when no comparisons exist yet. Never overrides active partner. */
export async function backfillLegacyComparisonIfNeeded(userId: string): Promise<void> {
  const { data: existingRows, error: listErr } = await supabase
    .from('relationship_validation_comparisons')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (listErr) throw new Error(listErr.message);
  if ((existingRows ?? []).length > 0) return;

  const { data: row, error } = await supabase
    .from('relationship_validation_records')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.partner_email_entered) return;

  const partnerEmail = normalizePartnerEmail(String(row.partner_email_entered));
  const { data: inserted, error: insertErr } = await supabase
    .from('relationship_validation_comparisons')
    .insert({
      user_id: userId,
      partner_email_entered: partnerEmail,
      partner_user_id: row.partner_user_id,
      pair_confirmed_at: row.pair_confirmed_at,
      pre_assessment: row.pre_assessment,
      post_assessment: row.post_assessment,
      compatibility_score: row.compatibility_score,
      compatibility_breakdown: row.compatibility_breakdown,
      profile_report_markdown: row.profile_report_markdown,
      profile_report_source_hash: row.profile_report_source_hash,
      profile_report_generated_at: row.profile_report_generated_at,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);
  if (!row.active_comparison_id) {
    await setActiveComparisonId(userId, inserted.id);
  }
}

/** @deprecated Use backfillLegacyComparisonIfNeeded — kept for callers that expect the old name. */
export async function ensureValidationComparisonsReady(userId: string): Promise<void> {
  await backfillLegacyComparisonIfNeeded(userId);
  const base = await fetchBaseValidationRecord(userId);
  if (base?.active_comparison_id) return;
  const { data: first, error } = await supabase
    .from('relationship_validation_comparisons')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (first?.id) {
    await setActiveComparisonId(userId, first.id);
  }
}

export async function fetchComparisonByPartnerEmail(
  userId: string,
  partnerEmail: string,
): Promise<RelationshipValidationComparison | null> {
  const normalized = normalizePartnerEmail(partnerEmail);
  const { data, error } = await supabase
    .from('relationship_validation_comparisons')
    .select('*')
    .eq('user_id', userId)
    .ilike('partner_email_entered', normalized);
  if (error) throw new Error(error.message);
  const row = (data ?? []).find(
    (c) => normalizePartnerEmail(String(c.partner_email_entered ?? '')) === normalized,
  );
  return (row as RelationshipValidationComparison | undefined) ?? null;
}

async function setActiveComparisonId(userId: string, comparisonId: string): Promise<void> {
  await ensureRelationshipValidationRecord(userId);
  const { error } = await supabase
    .from('relationship_validation_records')
    .update({
      active_comparison_id: comparisonId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

async function requireActiveComparisonId(userId: string): Promise<string> {
  await backfillLegacyComparisonIfNeeded(userId);
  const base = await fetchBaseValidationRecord(userId);
  if (!base?.active_comparison_id) {
    throw new Error('No active partner comparison');
  }
  return base.active_comparison_id;
}

export async function fetchUserValidationTrack(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('validation_track')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.validation_track as string | null) ?? null;
}

export async function ensureRelationshipValidationRecord(userId: string): Promise<void> {
  const { error } = await supabase.from('relationship_validation_records').upsert(
    { user_id: userId },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function fetchRelationshipValidationRecord(
  userId: string,
): Promise<RelationshipValidationRecord | null> {
  const { data: row, error } = await supabase
    .from('relationship_validation_records')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  if (row.partner_email_entered && !row.active_comparison_id) {
    await backfillLegacyComparisonIfNeeded(userId);
    const { data: refreshed, error: refreshErr } = await supabase
      .from('relationship_validation_records')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (refreshErr) throw new Error(refreshErr.message);
    if (refreshed) {
      row.active_comparison_id = refreshed.active_comparison_id;
    }
  }

  const base: BaseValidationRecord = {
    user_id: row.user_id,
    active_comparison_id: (row.active_comparison_id as string | null) ?? null,
    welcome_completed_at: row.welcome_completed_at as string | null,
    psychometrics_completed_at: row.psychometrics_completed_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };

  if (base.active_comparison_id) {
    const comparison = await fetchValidationComparison(base.active_comparison_id);
    return mergeRecordWithComparison(base, comparison);
  }

  if (row.partner_email_entered) {
    return {
      ...base,
      active_comparison_id: null,
      partner_email_entered: row.partner_email_entered as string,
      partner_user_id: (row.partner_user_id as string | null) ?? null,
      pair_confirmed_at: (row.pair_confirmed_at as string | null) ?? null,
      pre_assessment: row.pre_assessment as RelationshipValidationPreAssessment | null,
      post_assessment: row.post_assessment as RelationshipValidationPostAssessment | null,
      compatibility_score: row.compatibility_score as number | null,
      compatibility_breakdown:
        row.compatibility_breakdown as RelationshipValidationCompatibilityBreakdown | null,
      profile_report_markdown: (row.profile_report_markdown as string | null) ?? null,
      profile_report_source_hash: (row.profile_report_source_hash as string | null) ?? null,
      profile_report_generated_at: (row.profile_report_generated_at as string | null) ?? null,
    };
  }

  return mergeRecordWithComparison(base, null);
}

export async function markValidationWelcomeCompleted(userId: string): Promise<void> {
  await ensureRelationshipValidationRecord(userId);
  const { error } = await supabase
    .from('relationship_validation_records')
    .update({
      welcome_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

async function createOrActivateComparison(
  userId: string,
  email: string,
  opts?: { resetSurveyFields?: boolean },
): Promise<RelationshipValidationComparison> {
  await ensureRelationshipValidationRecord(userId);
  const normalized = normalizePartnerEmail(email);
  const existing = await fetchComparisonByPartnerEmail(userId, normalized);

  if (existing) {
    if (opts?.resetSurveyFields) {
      const { data, error } = await supabase
        .from('relationship_validation_comparisons')
        .update({
          partner_user_id: null,
          pair_confirmed_at: null,
          pre_assessment: null,
          post_assessment: null,
          compatibility_score: null,
          compatibility_breakdown: null,
          profile_report_markdown: null,
          profile_report_source_hash: null,
          profile_report_generated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      await setActiveComparisonId(userId, existing.id);
      return data as RelationshipValidationComparison;
    }
    await setActiveComparisonId(userId, existing.id);
    return existing;
  }

  const { data, error } = await supabase
    .from('relationship_validation_comparisons')
    .insert({
      user_id: userId,
      partner_email_entered: normalized,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await setActiveComparisonId(userId, data.id);
  return data as RelationshipValidationComparison;
}

export async function savePartnerEmailEntered(userId: string, email: string): Promise<void> {
  await createOrActivateComparison(userId, email);
}

/** Select or create a partner comparison and make it active. Preserves prior comparisons. */
export async function startNewPartnerComparison(userId: string, email: string): Promise<void> {
  await createOrActivateComparison(userId, email);
}

export async function setActiveValidationComparison(
  userId: string,
  comparisonId: string,
): Promise<void> {
  const comparison = await fetchValidationComparison(comparisonId);
  if (!comparison || comparison.user_id !== userId) {
    throw new Error('Comparison not found');
  }
  await setActiveComparisonId(userId, comparisonId);
}

export async function savePreAssessment(
  userId: string,
  pre: RelationshipValidationPreAssessment,
): Promise<void> {
  const comparisonId = await requireActiveComparisonId(userId);
  const { error } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      pre_assessment: pre,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comparisonId);
  if (error) throw new Error(error.message);
}

export async function savePostAssessment(
  userId: string,
  post: RelationshipValidationPostAssessment,
): Promise<void> {
  const comparisonId = await requireActiveComparisonId(userId);
  const { error } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      post_assessment: post,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comparisonId);
  if (error) throw new Error(error.message);
}

export async function markValidationPsychometricsCompleted(userId: string): Promise<void> {
  const { error } = await supabase
    .from('relationship_validation_records')
    .update({
      psychometrics_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function saveCompatibilityResultForComparison(
  comparisonId: string,
  score: number,
  breakdown: RelationshipValidationCompatibilityBreakdown,
): Promise<void> {
  const { error } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      compatibility_score: score,
      compatibility_breakdown: breakdown,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comparisonId);
  if (error) throw new Error(error.message);
}

/** @deprecated Use saveCompatibilityResultForComparison */
export async function saveCompatibilityResult(
  userId: string,
  score: number,
  breakdown: RelationshipValidationCompatibilityBreakdown,
): Promise<void> {
  const comparisonId = await requireActiveComparisonId(userId);
  await saveCompatibilityResultForComparison(comparisonId, score, breakdown);
}

export async function linkValidationComparisonPair(
  selfComparisonId: string,
  partnerComparisonId: string,
  partnerUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error: selfErr } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      partner_user_id: partnerUserId,
      pair_confirmed_at: now,
      updated_at: now,
    })
    .eq('id', selfComparisonId);
  if (selfErr) throw new Error(selfErr.message);

  const base = await fetchValidationComparison(selfComparisonId);
  if (!base) throw new Error('Comparison not found');

  const { error: partnerErr } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      partner_user_id: base.user_id,
      pair_confirmed_at: now,
      updated_at: now,
    })
    .eq('id', partnerComparisonId);
  if (partnerErr) throw new Error(partnerErr.message);
}

export async function markValidationInterviewOptIn(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ validation_interview_opted_in_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function saveValidationProfileReport(
  userId: string,
  markdown: string,
  sourceHash: string,
): Promise<void> {
  const comparisonId = await requireActiveComparisonId(userId);
  const { error } = await supabase
    .from('relationship_validation_comparisons')
    .update({
      profile_report_markdown: markdown,
      profile_report_source_hash: sourceHash,
      profile_report_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', comparisonId);
  if (error) throw new Error(error.message);
}

export async function getActiveComparisonId(userId: string): Promise<string | null> {
  const base = await fetchBaseValidationRecord(userId);
  return base?.active_comparison_id ?? null;
}
