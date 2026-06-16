import { supabase } from '@data/supabase/client';
import { computePairCompatibilityScore } from '@features/compatibility/computePairCompatibilityScore';
import { loadMatchmakingUserSnapshot } from '@features/compatibility/loadMatchmakingUserSnapshot';
import { mapMatchmakingUserToCompatibilityInputs } from '@features/compatibility/mapMatchmakingUserToCompatibilityInputs';
import type { RelationshipValidationCompatibilityBreakdown } from './constants';
import {
  fetchComparisonByPartnerEmail,
  fetchRelationshipValidationRecord,
  fetchValidationComparison,
  getActiveComparisonId,
  linkValidationComparisonPair,
  saveCompatibilityResultForComparison,
  type RelationshipValidationRecord,
} from './relationshipValidationRepo';
import { validationInstrumentsCompleted } from './validationPsychometricsProgress';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mutual partner email match for the active comparison. */
export async function tryConfirmValidationPartnerPair(userId: string): Promise<{
  confirmed: boolean;
  partnerUserId: string | null;
  selfComparisonId: string | null;
  partnerComparisonId: string | null;
}> {
  const record = await fetchRelationshipValidationRecord(userId);
  const selfComparisonId = record?.active_comparison_id ?? null;
  if (!record?.partner_email_entered || !selfComparisonId) {
    return { confirmed: false, partnerUserId: null, selfComparisonId: null, partnerComparisonId: null };
  }

  const { data: selfUser, error: selfErr } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  if (selfErr) throw new Error(selfErr.message);
  const selfEmail = normalizeEmail(String(selfUser?.email ?? ''));
  if (!selfEmail) {
    return { confirmed: false, partnerUserId: null, selfComparisonId, partnerComparisonId: null };
  }

  const partnerEmail = normalizeEmail(record.partner_email_entered);
  const { data: partnerUsers, error: partnerErr } = await supabase
    .from('users')
    .select('id, email')
    .ilike('email', partnerEmail);
  if (partnerErr) throw new Error(partnerErr.message);

  const partnerUser = (partnerUsers ?? []).find(
    (row) => normalizeEmail(String(row.email ?? '')) === partnerEmail,
  );
  if (!partnerUser?.id) {
    return { confirmed: false, partnerUserId: null, selfComparisonId, partnerComparisonId: null };
  }

  const partnerComparison = await fetchComparisonByPartnerEmail(partnerUser.id, selfEmail);
  if (!partnerComparison) {
    return { confirmed: false, partnerUserId: null, selfComparisonId, partnerComparisonId: null };
  }

  await linkValidationComparisonPair(selfComparisonId, partnerComparison.id, partnerUser.id);

  return {
    confirmed: true,
    partnerUserId: partnerUser.id,
    selfComparisonId,
    partnerComparisonId: partnerComparison.id,
  };
}

export async function computeAndStoreValidationPairScore(
  userId: string,
  partnerUserId: string,
  selfComparisonId: string,
  partnerComparisonId: string,
): Promise<RelationshipValidationCompatibilityBreakdown> {
  const [loadedA, loadedB] = await Promise.all([
    loadMatchmakingUserSnapshot(supabase, userId),
    loadMatchmakingUserSnapshot(supabase, partnerUserId),
  ]);

  const mappedA = mapMatchmakingUserToCompatibilityInputs(loadedA.snapshot, loadedA.extras);
  const mappedB = mapMatchmakingUserToCompatibilityInputs(loadedB.snapshot, loadedB.extras);
  const result = computePairCompatibilityScore(mappedA, mappedB);

  const breakdown: RelationshipValidationCompatibilityBreakdown = {
    attachment: result.subscores.attachment,
    values: result.subscores.values,
    conflictStyle: Math.max(0, Math.min(1, 0.5 + result.adjustments.conflictStyle * 5)),
    finalScore: result.finalScore,
  };

  await Promise.all([
    saveCompatibilityResultForComparison(selfComparisonId, result.finalScore, breakdown),
    saveCompatibilityResultForComparison(partnerComparisonId, result.finalScore, breakdown),
  ]);

  return breakdown;
}

export async function isValidationPsychometricsComplete(userId: string): Promise<boolean> {
  const record = await fetchRelationshipValidationRecord(userId);
  if (record?.psychometrics_completed_at) return true;
  const { complete } = await validationInstrumentsCompleted(userId);
  return complete;
}

export async function maybeComputeValidationPairScore(userId: string): Promise<{
  partnerComplete: boolean;
  breakdown: RelationshipValidationCompatibilityBreakdown | null;
  activeComparisonId: string | null;
}> {
  const activeComparisonId = await getActiveComparisonId(userId);
  const { confirmed, partnerUserId, selfComparisonId, partnerComparisonId } =
    await tryConfirmValidationPartnerPair(userId);
  if (!confirmed || !partnerUserId || !selfComparisonId || !partnerComparisonId) {
    return { partnerComplete: false, breakdown: null, activeComparisonId };
  }

  const partnerRecord = await fetchRelationshipValidationRecord(partnerUserId);
  if (!partnerRecord?.psychometrics_completed_at) {
    return { partnerComplete: false, breakdown: null, activeComparisonId };
  }

  const breakdown = await computeAndStoreValidationPairScore(
    userId,
    partnerUserId,
    selfComparisonId,
    partnerComparisonId,
  );
  return { partnerComplete: true, breakdown, activeComparisonId };
}

export type ValidationFlowStep =
  | 'welcome'
  | 'partner_email'
  | 'pre_assessment'
  | 'psychometrics'
  | 'report';

export function resolveValidationFlowStep(
  record: RelationshipValidationRecord | null,
): ValidationFlowStep {
  if (!record?.welcome_completed_at) return 'welcome';
  if (!record.partner_email_entered) return 'partner_email';
  if (!record.pre_assessment) return 'pre_assessment';
  if (!record.psychometrics_completed_at) return 'psychometrics';
  return 'report';
}

export async function resolveValidationFlowStepAfterPartnerSwitch(
  userId: string,
  comparisonId: string,
): Promise<ValidationFlowStep> {
  const comparison = await fetchValidationComparison(comparisonId);
  if (!comparison) return 'partner_email';
  if (!comparison.pre_assessment) return 'pre_assessment';
  const psychometricsDone = await isValidationPsychometricsComplete(userId);
  if (!psychometricsDone) return 'psychometrics';
  return 'report';
}
