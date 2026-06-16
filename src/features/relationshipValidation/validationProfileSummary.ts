import { supabase } from '@data/supabase/client';
import {
  attachmentStyleDisplayName,
  attachmentStyleFromScores,
  attachmentStyleSummary,
} from '@/data/assessments/insightContent';
import type { ConflictStyleKey } from '@/data/assessments/instruments/conflictStyleTypes';
import { styleDisplayName } from '@/data/assessments/conflictStyleResultsNarrative';

export type ValidationSelfProfileSummary = {
  attachmentLabel: string;
  attachmentDescription: string;
  topValues: string[];
  conflictStyleLabel: string;
};

export async function loadValidationSelfProfileSummary(
  userId: string,
): Promise<ValidationSelfProfileSummary | null> {
  const { data: assessments, error } = await supabase
    .from('user_assessments')
    .select('instrument, scores')
    .eq('user_id', userId)
    .in('instrument', ['ECR-36', 'PVQ-21', 'CONFLICT-30']);
  if (error) throw new Error(error.message);

  const byInstrument = new Map(
    (assessments ?? []).map((row) => [String(row.instrument), row.scores as Record<string, number>]),
  );

  const ecr = byInstrument.get('ECR-36');
  const pvq = byInstrument.get('PVQ-21');
  const conflict = byInstrument.get('CONFLICT-30');

  if (!ecr || !pvq || !conflict) return null;

  const anxiety = Number(ecr.anxiety ?? ecr.Anxiety);
  const avoidance = Number(ecr.avoidance ?? ecr.Avoidance);
  const style = attachmentStyleFromScores(anxiety, avoidance);
  const attachmentLabel = attachmentStyleDisplayName(style);

  const valueEntries = Object.entries(pvq)
    .filter(([k]) => k !== 'instrument')
    .map(([key, val]) => ({ key, val: Number(val) }))
    .filter((e) => Number.isFinite(e.val))
    .sort((a, b) => b.val - a.val);
  const topValues = valueEntries.slice(0, 3).map((e) => e.key.replace(/_/g, ' '));

  const conflictEntries = Object.entries(conflict)
    .map(([key, val]) => ({ key, val: Number(val) }))
    .filter((e) => Number.isFinite(e.val));
  const topConflict = conflictEntries.sort((a, b) => b.val - a.val)[0];
  const conflictStyleLabel = topConflict
    ? styleDisplayName(topConflict.key as ConflictStyleKey)
    : 'Unknown';

  return {
    attachmentLabel,
    attachmentDescription: attachmentStyleSummary(style),
    topValues,
    conflictStyleLabel,
  };
}
