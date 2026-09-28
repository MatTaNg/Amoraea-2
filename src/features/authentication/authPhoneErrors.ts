export function isPhoneNotConfirmedAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return lower.includes('phone not confirmed') || lower.includes('confirm your phone');
}

export function isAuthSmsRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code === 'over_sms_send_rate_limit') return true;
  const msg = (err as { message?: string }).message?.toLowerCase() ?? '';
  return msg.includes('sms rate limit') || msg.includes('only request this after');
}

export function formatAuthSmsRateLimitMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message?: string }).message ?? '');
    const match = raw.match(/after (\d+) seconds?/i);
    if (match) {
      const seconds = Number.parseInt(match[1], 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        return `Too many texts sent. Please wait ${seconds} seconds before trying again.`;
      }
    }
  }
  return 'Too many texts sent. Please wait a few minutes before trying again.';
}

function readAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  return String(err ?? '');
}

function readAuthErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Map Supabase/Twilio SMS failures to user-facing copy (signup, link-phone, resend). */
export function getAuthSmsSendErrorMessage(err: unknown, fallback: string): string {
  if (isAuthSmsRateLimitError(err)) {
    return formatAuthSmsRateLimitMessage(err);
  }

  const code = readAuthErrorCode(err);
  const msg = readAuthErrorMessage(err).trim();
  const lower = msg.toLowerCase();

  if (code === 'sms_send_failed' || lower.includes('error sending confirmation otp')) {
    if (lower.includes('not a valid phone number') || lower.includes('21211')) {
      return 'That phone number could not receive texts. Double-check the number (include US area code) or use a Supabase test number during development.';
    }
    if (
      lower.includes('unverified') ||
      lower.includes('trial') ||
      lower.includes('21608') ||
      lower.includes('verified caller')
    ) {
      return 'SMS could not be delivered. Twilio trial accounts must verify your phone number in the Twilio console (Verified Caller IDs) before texts can arrive.';
    }
    if (lower.includes('authenticate') || lower.includes('20003') || lower.includes('invalid username')) {
      return 'SMS provider credentials look invalid in Supabase. Try Twilio Verify in Authentication → Providers → Phone, or re-enter Account SID and Auth Token.';
    }
    if (msg.length > 0) return msg;
    return 'Could not send a verification text. Check your number and try again in a minute.';
  }

  if (msg.length > 0) return msg;
  return fallback;
}
