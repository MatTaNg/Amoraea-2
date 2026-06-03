import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendResultsEmailForAttempt } from '../_shared/sendResultsEmailForAttempt.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, baggage, sentry-trace',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const ADMIN_CONSOLE_EMAIL = 'admin@amoraea.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!url || !serviceKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { userId?: string; attemptId?: string; force?: boolean };
    try {
      body = (await req.json()) as { userId?: string; attemptId?: string };
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = (body.userId ?? '').trim();
    const attemptId = (body.attemptId ?? '').trim();
    const force = body.force === true;
    if (!userId || !attemptId) {
      return new Response(JSON.stringify({ error: 'userId and attemptId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    const authUser = userData.user;
    const authUserId = authUser?.id;
    const authEmail = (authUser?.email ?? '').trim().toLowerCase();
    const adminOverride = authEmail === ADMIN_CONSOLE_EMAIL;
    if (userErr || !authUserId || (!adminOverride && authUserId !== userId)) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: attemptRow, error: attemptErr } = await supabase
      .from('interview_attempts')
      .select('id')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    if (attemptErr) {
      return new Response(JSON.stringify({ error: attemptErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!attemptRow) {
      return new Response(JSON.stringify({ error: 'Attempt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await sendResultsEmailForAttempt(supabase, attemptId, userId, {
      force: force && adminOverride,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-results-email] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
