import { supabase } from '../supabase/client';

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

    if (options.referralCode?.trim()) {
      referredById = await this.findUserIdByCode(options.referralCode.trim());
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
    });

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    return { inviteCode };
  }
}
