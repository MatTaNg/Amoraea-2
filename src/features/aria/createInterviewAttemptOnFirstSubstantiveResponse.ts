import { supabase } from '@data/supabase/client';
import { countInterviewWords } from '@features/aria/moment4AnswerSignals';
import {
  countSubstantiveInterviewAttemptsForUser,
  fetchLatestNonPhantomInProgressAttemptId,
} from '@features/interview/interviewAttemptLifecycle';
import { remoteLog } from '@utilities/remoteLog';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

/** Creates interview_attempts row on first substantive Scenario A answer (not on screen load / ready confirmation). */
export async function createInterviewAttemptOnFirstSubstantiveResponse(
  userId: string,
  userText: string,
  scenarioNumber: 1,
  platform: 'ios' | 'android' | 'web',
): Promise<string | null> {
  const existingInProgress = await fetchLatestNonPhantomInProgressAttemptId(userId);
  if (existingInProgress) return existingInProgress;

  const substantiveCount = await countSubstantiveInterviewAttemptsForUser(userId);
  const attemptNumber = substantiveCount + 1;
  const { data: attemptRow, error: attemptErr } = await supabase
    .from('interview_attempts')
    .insert({
      user_id: userId,
      attempt_number: attemptNumber,
      transcript: [],
      is_phantom: false,
    })
    .select('id')
    .single();
  if (attemptErr || !attemptRow?.id) {
    await remoteLog('[attempt_record_created] failed', {
      message: attemptErr?.message ?? 'missing id',
    });
    return null;
  }
  writeSessionLog({
    userId,
    attemptId: attemptRow.id,
    eventType: 'attempt_record_created',
    eventData: {
      trigger_reason: 'first_substantive_response',
      word_count: countInterviewWords(userText),
      scenario_number: scenarioNumber,
      created_at: new Date().toISOString(),
    },
    platform,
  });
  await remoteLog('[attempt_record_created]', {
    attemptId: attemptRow.id,
    attemptNumber,
    wordCount: countInterviewWords(userText),
    scenarioNumber,
  });
  return attemptRow.id;
}
