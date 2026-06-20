import { supabase } from '@data/supabase/client';
import { computePairCompatibilityScore } from '@features/compatibility/computePairCompatibilityScore';
import { loadMatchmakingUserSnapshot } from '@features/compatibility/loadMatchmakingUserSnapshot';
import { mapMatchmakingUserToCompatibilityInputs } from '@features/compatibility/mapMatchmakingUserToCompatibilityInputs';
import type { RelationshipValidationCompatibilityBreakdown } from './constants';
import {
  fetchRelationshipValidationRecord,
  fetchValidationComparison,
  getActiveComparisonId,
  saveCompatibilityResultForComparison,
  type RelationshipValidationRecord,
} from './relationshipValidationRepo';
import { validationInstrumentsCompleted } from './validationPsychometricsProgress';

export type ValidationPartnerPairSyncResult = {
  confirmed: boolean;
  partnerUserId: string | null;
  selfComparisonId: string | null;
  partnerComparisonId: string | null;
  selfPsychometricsComplete: boolean;
  partnerPsychometricsComplete: boolean;
  partnerComplete: boolean;
  reason: string | null;
};

function parseValidationPartnerPairSyncResult(data: unknown): ValidationPartnerPairSyncResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    confirmed: row.confirmed === true,
    partnerUserId: typeof row.partner_user_id === 'string' ? row.partner_user_id : null,
    selfComparisonId: typeof row.self_comparison_id === 'string' ? row.self_comparison_id : null,
    partnerComparisonId:
      typeof row.partner_comparison_id === 'string' ? row.partner_comparison_id : null,
    selfPsychometricsComplete: row.self_psychometrics_complete === true,
    partnerPsychometricsComplete: row.partner_psychometrics_complete === true,
    partnerComplete: row.partner_complete === true,
    reason: typeof row.reason === 'string' ? row.reason : null,
  };
}

/** Mutual partner email match for the active comparison (server-side; bypasses users RLS). */
export async function syncValidationPartnerPair(
  userId: string,
): Promise<ValidationPartnerPairSyncResult> {
  const { data, error } = await supabase.rpc('sync_validation_partner_pair');
  if (error) throw new Error(error.message);
  void userId;
  return parseValidationPartnerPairSyncResult(data);
}

/** @deprecated Prefer syncValidationPartnerPair — kept for tests and legacy callers. */
export async function tryConfirmValidationPartnerPair(userId: string): Promise<{
  confirmed: boolean;
  partnerUserId: string | null;
  selfComparisonId: string | null;
  partnerComparisonId: string | null;
}> {
  const result = await syncValidationPartnerPair(userId);
  return {
    confirmed: result.confirmed,
    partnerUserId: result.partnerUserId,
    selfComparisonId: result.selfComparisonId,
    partnerComparisonId: result.partnerComparisonId,
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
  const { complete } = await validationInstrumentsCompleted(userId);
  return complete;
}

export async function maybeComputeValidationPairScore(userId: string): Promise<{
  partnerComplete: boolean;
  breakdown: RelationshipValidationCompatibilityBreakdown | null;
  activeComparisonId: string | null;
  pairSyncReason: string | null;
}> {
  const activeComparisonId = await getActiveComparisonId(userId);
  const pairSync = await syncValidationPartnerPair(userId);
  const {
    confirmed,
    partnerUserId,
    selfComparisonId,
    partnerComparisonId,
    partnerComplete: psychometricsReady,
    reason,
  } = pairSync;

  if (!confirmed || !partnerUserId || !selfComparisonId || !partnerComparisonId) {
    return { partnerComplete: false, breakdown: null, activeComparisonId, pairSyncReason: reason };
  }

  if (!psychometricsReady) {
    return { partnerComplete: false, breakdown: null, activeComparisonId, pairSyncReason: reason };
  }

  try {
    const breakdown = await computeAndStoreValidationPairScore(
      userId,
      partnerUserId,
      selfComparisonId,
      partnerComparisonId,
    );
    return { partnerComplete: true, breakdown, activeComparisonId, pairSyncReason: null };
  } catch (err) {
    console.warn('[maybeComputeValidationPairScore] compute failed:', err);
    return { partnerComplete: false, breakdown: null, activeComparisonId, pairSyncReason: 'compute_failed' };
  }
}

export type ValidationFlowStep =
  | 'welcome'
  | 'partner_email'
  | 'pre_assessment'
  | 'relationship_test_mode'
  | 'psychometrics'
  | 'report';

export function needsRelationshipTestModeStep(
  record: RelationshipValidationRecord | null,
): boolean {
  return record?.relationship_test_mode == null;
}

export async function resolveValidationFlowStep(
  userId: string,
  record: RelationshipValidationRecord | null,
): Promise<ValidationFlowStep> {
  if (!record?.welcome_completed_at) return 'welcome';
  if (!record.partner_email_entered) return 'partner_email';
  if (needsRelationshipTestModeStep(record)) return 'relationship_test_mode';
  if (!record.pre_assessment) return 'pre_assessment';
  const psychometricsDone = await isValidationPsychometricsComplete(userId);
  if (!psychometricsDone) return 'psychometrics';
  return 'report';
}

export async function resolveValidationFlowStepAfterPartnerSwitch(
  userId: string,
  comparisonId: string,
): Promise<ValidationFlowStep> {
  const comparison = await fetchValidationComparison(comparisonId);
  if (!comparison) return 'partner_email';
  const record = await fetchRelationshipValidationRecord(userId);
  if (needsRelationshipTestModeStep(record)) return 'relationship_test_mode';
  if (!comparison.pre_assessment) return 'pre_assessment';
  const psychometricsDone = await isValidationPsychometricsComplete(userId);
  if (!psychometricsDone) return 'psychometrics';
  return 'report';
}
