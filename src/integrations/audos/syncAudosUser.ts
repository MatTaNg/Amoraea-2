import type { User } from '@supabase/supabase-js';
import { audos } from './audosSdk';

function displayNameFromUser(user: User): string | undefined {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (!meta) return undefined;
  const full =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  if (full) return full;
  const first = typeof meta.first_name === 'string' ? meta.first_name.trim() : '';
  const last = typeof meta.last_name === 'string' ? meta.last_name.trim() : '';
  const joined = [first, last].filter(Boolean).join(' ');
  return joined || undefined;
}

/** Best-effort identify after Supabase session is verified (web only; native no-ops). */
export function syncAudosIdentifyFromSupabaseUser(user: User | null): void {
  if (!user?.email?.trim()) return;

  void audos
    .identify({
      email: user.email.trim(),
      name: displayNameFromUser(user),
      properties: {
        supabaseUserId: user.id,
      },
    })
    .catch(() => {
      /* network / consent — non-fatal */
    });
}
