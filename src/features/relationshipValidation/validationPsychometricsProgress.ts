import { supabase } from '@data/supabase/client';
import { RELATIONSHIP_VALIDATION_INSTRUMENT_IDS } from './constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPartnerEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export async function validationInstrumentsCompleted(userId: string): Promise<{
  complete: boolean;
  nextStep: 'ECR-36' | 'PVQ-21' | 'CONFLICT-30' | null;
}> {
  const { data: assessments, error } = await supabase
    .from('user_assessments')
    .select('instrument')
    .eq('user_id', userId)
    .in('instrument', [...RELATIONSHIP_VALIDATION_INSTRUMENT_IDS]);
  if (error) throw new Error(error.message);

  const done = new Set((assessments ?? []).map((row) => String(row.instrument)));
  for (const id of RELATIONSHIP_VALIDATION_INSTRUMENT_IDS) {
    if (!done.has(id)) {
      return { complete: false, nextStep: id };
    }
  }

  return { complete: true, nextStep: null };
}
