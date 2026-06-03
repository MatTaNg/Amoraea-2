import { supabase } from '@data/supabase/client';
import type { InterviewSelfInsightSource } from '@features/aria/interviewSelfInsightCopy';

type AttemptInsightRow = {
  passed: boolean | null;
  ego_development_level?: number | null;
  defense_patterns?: unknown;
  emotion_recognition_raw_score?: number | null;
  moment_4_concreteness?: string | null;
  moment_5_concreteness?: string | null;
  mentalizing_overcertainty_count?: number | null;
  disclosure_calibration?: string | null;
};

/**
 * Loads interview-derived self-insight fields from the user’s latest attempt when they passed.
 * Returns `null` if there is no safe snapshot (not passed, missing attempt, or load error).
 */
export async function fetchInterviewSelfInsightSource(userId: string): Promise<InterviewSelfInsightSource | null> {
  const { data: userRow, error: uErr } = await supabase
    .from('users')
    .select('latest_attempt_id, interview_passed')
    .eq('id', userId)
    .maybeSingle();
  if (uErr || !userRow?.latest_attempt_id) return null;
  if (userRow.interview_passed !== true) return null;

  const attemptId = userRow.latest_attempt_id as string;
  const selectWithDisclosure =
    'passed, ego_development_level, defense_patterns, emotion_recognition_raw_score, moment_4_concreteness, moment_5_concreteness, mentalizing_overcertainty_count, disclosure_calibration';
  const selectBase =
    'passed, ego_development_level, defense_patterns, emotion_recognition_raw_score, moment_4_concreteness, moment_5_concreteness, mentalizing_overcertainty_count';

  let attRes = await supabase
    .from('interview_attempts')
    .select(selectWithDisclosure)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (attRes.error && /disclosure_calibration|PGRST204/i.test(String(attRes.error.message ?? ''))) {
    attRes = await supabase
      .from('interview_attempts')
      .select(selectBase)
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();
  }

  const { data: att, error: aErr } = attRes;
  if (aErr || !att) return null;
  const row = att as AttemptInsightRow;
  if (row.passed !== true) return null;

  return {
    egoDevelopmentLevel: row.ego_development_level ?? null,
    defensePatterns: (row.defense_patterns as InterviewSelfInsightSource['defensePatterns']) ?? null,
    emotionRecognitionRawScore: row.emotion_recognition_raw_score ?? null,
    moment4Concreteness: row.moment_4_concreteness ?? null,
    moment5Concreteness: row.moment_5_concreteness ?? null,
    mentalizingOvercertaintyCount: row.mentalizing_overcertainty_count ?? null,
    disclosureCalibration: row.disclosure_calibration ?? null,
  };
}
