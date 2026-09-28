import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  generateSignupLeadToken,
  hashSignupLeadToken,
  isValidSignupLeadEmail,
  normalizeSignupLeadEmail,
} from '../_shared/signupLeadCrypto.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-signup-lead-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const LEAD_TTL_DAYS = 30;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function authorizeCreateRequest(req: Request): boolean {
  const configuredSecret = Deno.env.get('SIGNUP_LEAD_CREATE_SECRET')?.trim();
  if (!configuredSecret) return true;
  const provided = req.headers.get('x-signup-lead-secret')?.trim();
  return provided === configuredSecret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!authorizeCreateRequest(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const emailRaw =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email
      : '';
  const email = normalizeSignupLeadEmail(emailRaw);
  if (!isValidSignupLeadEmail(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: claimedLead } = await admin
    .from('signup_leads')
    .select('id')
    .eq('email', email)
    .not('claimed_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (claimedLead?.id) {
    return jsonResponse({ ok: true });
  }

  const token = generateSignupLeadToken();
  const tokenHash = await hashSignupLeadToken(token);
  const expiresAt = new Date(Date.now() + LEAD_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: openLead } = await admin
    .from('signup_leads')
    .select('id')
    .eq('email', email)
    .is('claimed_at', null)
    .maybeSingle();

  if (openLead?.id) {
    const { error: updateErr } = await admin
      .from('signup_leads')
      .update({ token_hash: tokenHash, expires_at: expiresAt })
      .eq('id', openLead.id);
    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 500);
    }
  } else {
    const { error: insertErr } = await admin.from('signup_leads').insert({
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertErr) {
      return jsonResponse({ error: insertErr.message }, 500);
    }
  }

  return jsonResponse({ ok: true, token });
});
