import { supabase } from '../supabase/client';
import { signOutIfUsersAuthFkViolation } from '../supabase/signOutIfUsersAuthFkViolation';
import { isAlphaTesterReferralCode } from '@/constants/alphaReferral';
import { normalizeShareableReferralCode } from '@features/referrals/shareableReferralCode';

const INVITE_CODE_LENGTH = 6;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I,O,0,1 for clarity

function generateCode(): string {
  let result = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

export class InviteCodeRepository {
  async findUserIdByCode(code: string): Promise<string | null> {
    const trimmed = code?.trim();
    if (!trimmed) return null;

    const { data, error } = await supabase.rpc('get_user_id_by_invite_code', {
      code: trimmed,
    });

    if (error || !data) return null;
    return data as string;
  }

  async ensureUserWithInviteCode(
    userId: string,
    options: { email?: string; referralCode?: string }
  ): Promise<{ inviteCode: string }> {
    const { data: existing } = await supabase
      .from('users')
      .select('id, invite_code')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      return { inviteCode: existing.invite_code || '' };
    }

    let inviteCode = generateCode();
    let referredById: string | null = null;
    let pendingReferralCode: string | null = null;
    let isAlphaTester = false;

    const raw = options.referralCode?.trim() ?? '';
    if (raw) {
      if (isAlphaTesterReferralCode(raw)) {
        isAlphaTester = true;
      } else {
        const normalizedShareable = normalizeShareableReferralCode(raw);
        if (normalizedShareable) {
          const { data: available, error: rpcErr } = await supabase.rpc('referral_code_is_available', {
            p_raw: raw,
          });
          if (!rpcErr && available === true) {
            pendingReferralCode = normalizedShareable;
          }
        } else {
          referredById = await this.findUserIdByCode(raw);
        }
      }
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: conflict } = await supabase
        .from('users')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (!conflict) break;
      inviteCode = generateCode();
    }

    const { error } = await supabase.from('users').insert({
      id: userId,
      email: options.email ?? null,
      invite_code: inviteCode,
      referred_by_id: referredById,
      is_alpha_tester: isAlphaTester,
      pending_referral_code: pendingReferralCode,
    });

    if (error) {
      const err = error as { code?: string; message?: string };
      // Concurrent ensureUserWithInviteCode (e.g. duplicate profile query) can both pass the
      // pre-insert select; the second insert hits users_pkey. Treat as success if row exists.
      if (err.code === '23505') {
        const { data: raced } = await supabase
          .from('users')
          .select('id, invite_code')
          .eq('id', userId)
          .maybeSingle();
        if (raced?.id) {
          return { inviteCode: raced.invite_code || '' };
        }
      }
      if (await signOutIfUsersAuthFkViolation(err)) {
        throw new Error('Your session is no longer valid. Please sign in again.');
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
    return { inviteCode };
  }
}
