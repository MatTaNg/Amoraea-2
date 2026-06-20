import { supabase } from '@data/supabase/client';

export async function fetchLaunchWaitlistPassedCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_launch_waitlist_passed_count');
  if (error) {
    console.warn('[LaunchWaitlist] failed to load passed count', error.message);
    return 0;
  }
  return typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : 0;
}
