import { supabase } from '@data/supabase/client';
import { isDevScenarioJumpEmail } from '@features/aria/devScenarioJumpReferral';

export function isEmailNotConfirmedAuthError(err: unknown): boolean {
  const msg = readAuthErrorMessage(err);
  const lower = msg.toLowerCase();
  return lower.includes('email not confirmed') || lower.includes('confirm your email');
}

function readAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  return String(err);
}

function isMissingDevAutoConfirmRpc(err: unknown): boolean {
  const msg = readAuthErrorMessage(err).toLowerCase();
  return (
    msg.includes('dev_auto_confirm_test_email') &&
    (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('404'))
  );
}

function shouldFallbackDevAutoConfirmToEdgeFunction(err: unknown): boolean {
  const msg = readAuthErrorMessage(err).toLowerCase();
  return (
    isMissingDevAutoConfirmRpc(err) ||
    msg.includes('confirmed_at') ||
    msg.includes('generated column')
  );
}

export function readAuthErrorMessageForDisplay(err: unknown): string {
  const msg = readAuthErrorMessage(err).trim();
  return msg || 'Something went wrong. Please try again.';
}

/**
 * Dev-only: auto-confirms mattang5280@gmail.com so signup/login skips the confirmation email step.
 * Prefers DB RPC (works after db push); falls back to edge function when RPC is not deployed yet.
 */
export async function confirmTestAccountEmailIfNeeded(
  email: string,
  userId?: string | null,
): Promise<void> {
  if (!isDevScenarioJumpEmail(email)) return;

  const trimmed = email.trim();
  const { error: rpcError } = await supabase.rpc('dev_auto_confirm_test_email', {
    p_email: trimmed,
    p_user_id: userId ?? null,
  });
  if (!rpcError) return;

  if (!shouldFallbackDevAutoConfirmToEdgeFunction(rpcError)) {
    throw new Error(readAuthErrorMessageForDisplay(rpcError));
  }

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'dev-auto-confirm-test-email',
    {
      body: {
        email: trimmed,
        ...(userId ? { userId } : {}),
      },
    },
  );
  if (error) throw new Error(readAuthErrorMessageForDisplay(error));
  if (data?.error) {
    throw new Error(String(data.error));
  }
}
