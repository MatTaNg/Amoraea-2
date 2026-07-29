import type { SaveInterviewResultsParams } from '@features/aria/saveInterviewResultsTypes';
import { supabase } from '@data/supabase/client';
import { buildUsersRowInterviewPassFromGate } from '@utilities/interviewPassEffective';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { clearUserEnteredInterviewFlow } from '@utilities/interviewEntryLock';

export async function runSaveInterviewResults(params: SaveInterviewResultsParams): Promise<void> {
  const { results, gateResult, uid } = params;
  if (!uid) return;
  try {
    const passFields = await buildUsersRowInterviewPassFromGate(supabase, uid, gateResult.pass);
    const { error } = await supabase
      .from('users')
      .update({
        interview_completed: true,
        ...passFields,
        interview_completed_at: new Date().toISOString(),
      })
      .eq('id', uid);
    if (error) console.error('Failed to save interview results:', error);
    else {
      await clearInterviewFromStorage(uid);
      await clearUserEnteredInterviewFlow(uid);
    }
  } catch (err) {
    console.error('Interview save error:', err);
  }
}
