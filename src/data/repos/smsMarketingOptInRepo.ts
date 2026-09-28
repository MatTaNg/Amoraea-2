import { supabase } from '@data/supabase/client';
import { parseSmsMarketingOptIn } from '@features/notifications/smsMarketingOptIn';

export async function fetchSmsMarketingOptIn(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('sms_marketing_opt_in')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return parseSmsMarketingOptIn((data as { sms_marketing_opt_in?: unknown } | null)?.sms_marketing_opt_in);
}

export async function updateSmsMarketingOptIn(userId: string, optIn: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      sms_marketing_opt_in: optIn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
