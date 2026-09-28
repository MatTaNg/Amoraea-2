import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashSignupLeadToken } from '../_shared/signupLeadCrypto.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user?.id) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const tokenRaw =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { token?: unknown }).token === 'string'
      ? (body as { token: string }).token.trim()
      : '';
  if (!tokenRaw || tokenRaw.length > 512) {
    return jsonResponse({ error: 'Invalid token' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await hashSignupLeadToken(tokenRaw);
  const nowIso = new Date().toISOString();

  const { data: lead, error: leadErr } = await admin
    .from('signup_leads')
    .select('id, email, claimed_at, expires_at, claimed_by_user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (leadErr) {
    return jsonResponse({ error: leadErr.message }, 500);
  }
  if (!lead) {
    return jsonResponse({ error: 'Invalid or expired signup link' }, 404);
  }
  if (lead.claimed_at) {
    if (lead.claimed_by_user_id === user.id) {
      return jsonResponse({ ok: true, email: lead.email, alreadyClaimed: true });
    }
    return jsonResponse({ error: 'This signup link has already been used' }, 409);
  }
  if (lead.expires_at && lead.expires_at <= nowIso) {
    return jsonResponse({ error: 'This signup link has expired' }, 410);
  }

  const { data: emailConflict } = await admin
    .from('users')
    .select('id')
    .eq('email', lead.email)
    .neq('id', user.id)
    .limit(1)
    .maybeSingle();

  if (emailConflict?.id) {
    return jsonResponse({ error: 'This email is already linked to another account' }, 409);
  }

  const { error: usersErr } = await admin
    .from('users')
    .update({ email: lead.email })
    .eq('id', user.id);
  if (usersErr) {
    return jsonResponse({ error: usersErr.message }, 500);
  }

  const { data: profileRow } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileRow?.id) {
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ email: lead.email })
      .eq('id', user.id);
    if (profileErr) {
      return jsonResponse({ error: profileErr.message }, 500);
    }
  } else {
    const displayName = lead.email.includes('@')
      ? lead.email.split('@')[0]!.trim() || 'Member'
      : 'Member';
    const { error: profileInsertErr } = await admin.from('profiles').insert({
      id: user.id,
      email: lead.email,
      display_name: displayName,
      profile_json: {},
    });
    if (profileInsertErr) {
      return jsonResponse({ error: profileInsertErr.message }, 500);
    }
  }

  const { error: claimErr } = await admin
    .from('signup_leads')
    .update({
      claimed_at: nowIso,
      claimed_by_user_id: user.id,
    })
    .eq('id', lead.id)
    .is('claimed_at', null);

  if (claimErr) {
    return jsonResponse({ error: claimErr.message }, 500);
  }

  return jsonResponse({ ok: true, email: lead.email });
});
