import { supabase } from '@data/supabase/client';
import { confirmAsync } from '@utilities/alerts/confirmDialog';

export async function confirmDeleteAdminUserAccount(message: string): Promise<boolean> {
  return confirmAsync({
    title: 'Delete account',
    message,
    confirmText: 'Delete',
  });
}

export async function deleteUserAccountViaEdge(userId: string): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  const body = data as { ok?: boolean; error?: string } | null;
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return { error: body.error };
  }
  if (error) {
    return { error: error.message };
  }
  if (body && typeof body === 'object' && body.ok === true) {
    return { ok: true };
  }
  return { error: 'Unexpected response from server' };
}
