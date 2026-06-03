import { supabase } from '@data/supabase/client';
import { saveAssessmentResult } from '@/data/services/assessmentService';
import { buildSexualCommunicationScores } from '@features/psychometrics/sexualCommunicationInsight';

export type SexualCommunicationStatus = {
  completed: boolean;
  skipped: boolean;
  score: number | null;
  completedAt: string | null;
};

const USER_SEXUAL_COMM_SELECT = `
  psychometrics_sexual_communication_score,
  psychometrics_sexual_communication_completed_at,
  psychometrics_sexual_communication_skipped_at,
  psychometrics_sexual_communication_partial_responses,
  psychometrics_sexual_communication_current_question_index
`;

export async function fetchSexualCommunicationStatus(
  userId: string,
): Promise<SexualCommunicationStatus> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SEXUAL_COMM_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { completed: false, skipped: false, score: null, completedAt: null };
  }

  return {
    completed: data.psychometrics_sexual_communication_completed_at != null,
    skipped: data.psychometrics_sexual_communication_skipped_at != null,
    score: data.psychometrics_sexual_communication_score as number | null,
    completedAt: data.psychometrics_sexual_communication_completed_at as string | null,
  };
}

export async function saveSexualCommunicationProgress(
  userId: string,
  questionIndex: number,
  responses: Record<number, number>,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      psychometrics_sexual_communication_current_question_index: questionIndex,
      psychometrics_sexual_communication_partial_responses: responses,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function saveSexualCommunicationResult(
  userId: string,
  responses: Record<number, number>,
): Promise<number> {
  const scores = buildSexualCommunicationScores(responses);
  const rawForSave: Record<string, number> = {};
  for (const [k, v] of Object.entries(responses)) {
    rawForSave[String(k)] = v;
  }

  const result = await saveAssessmentResult(userId, 'SEXUAL_COMMUNICATION', scores, rawForSave, {
    skipProfileUpdate: true,
  });
  if (!result.success) {
    throw result.error ?? new Error('Failed to save sexual communication assessment');
  }
  return scores.total ?? 0;
}

export async function fetchSexualCommunicationResponses(
  userId: string,
): Promise<Record<number, number> | null> {
  const { data, error } = await supabase
    .from('users')
    .select('psychometrics_sexual_communication_responses')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.psychometrics_sexual_communication_responses) return null;

  const raw = data.psychometrics_sexual_communication_responses as Record<string | number, number>;
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isFinite(id) && Number.isFinite(v)) out[id] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function skipSexualCommunicationAssessment(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      psychometrics_sexual_communication_skipped_at: new Date().toISOString(),
      psychometrics_sexual_communication_current_question_index: null,
      psychometrics_sexual_communication_partial_responses: null,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function loadSexualCommunicationResume(
  userId: string,
): Promise<{ questionIndex: number; responses: Record<number, number> }> {
  const { data } = await supabase
    .from('users')
    .select(
      'psychometrics_sexual_communication_current_question_index, psychometrics_sexual_communication_partial_responses, psychometrics_sexual_communication_responses',
    )
    .eq('id', userId)
    .maybeSingle();

  if (!data) return { questionIndex: 0, responses: {} };

  const partial =
    (data.psychometrics_sexual_communication_partial_responses as Record<number, number> | null) ??
    (data.psychometrics_sexual_communication_responses as Record<number, number> | null) ??
    {};

  return {
    questionIndex: Math.max(0, data.psychometrics_sexual_communication_current_question_index ?? 0),
    responses: partial,
  };
}

export function formatSexualCommunicationCompletedAt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function sexualCommunicationBand(score: number | null): {
  band: string;
  description: string;
} {
  if (score === null) return { band: 'Not assessed', description: '' };
  if (score >= 3.5) {
    return { band: 'High communication comfort', description: '' };
  }
  if (score >= 2.5) {
    return { band: 'Moderate communication comfort', description: '' };
  }
  return { band: 'Low communication comfort', description: '' };
}
