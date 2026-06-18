import { supabase } from '@data/supabase/client';
import {
  RELATIONSHIP_VALIDATION_INSTRUMENT_IDS,
  type RelationshipValidationInstrumentId,
} from './constants';

export {
  getPartnerEmailValidationError,
  isValidPartnerEmail,
  normalizePartnerEmail,
} from './partnerEmailValidation';

export async function fetchCurrentUserEmailForPartnerValidation(
  userId: string,
): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.email?.trim()) {
    return auth.user.email.trim().toLowerCase();
  }
  const { data } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
  if (typeof data?.email === 'string' && data.email.trim()) {
    return data.email.trim().toLowerCase();
  }
  return null;
}

export async function validationInstrumentsCompleted(userId: string): Promise<{
  complete: boolean;
  nextStep: RelationshipValidationInstrumentId | null;
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
