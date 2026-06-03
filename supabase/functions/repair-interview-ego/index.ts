import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { repairInterviewAttemptEgoCore } from '../_shared/repairInterviewAttemptEgoCore.ts';

const ADMIN_EMAIL = 'admin@amoraea.com';
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
    if (!supabaseUrl || !serviceRole || !anonKey) return json({ error: 'Server misconfiguration' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerErr,
    } = await userClient.auth.getUser();
    if (callerErr || caller?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return json({ error: callerErr ? 'Unauthorized' : 'Forbidden' }, callerErr ? 401 : 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const attemptId =
      typeof body === 'object' && body !== null && typeof (body as { attemptId?: unknown }).attemptId === 'string'
        ? (body as { attemptId: string }).attemptId.trim()
        : '';
    if (!attemptId) return json({ error: 'Missing attemptId' }, 400);

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: row, error: fetchErr } = await admin
      .from('interview_attempts')
      .select('id, user_id, transcript, interview_typology_context, ego_development_level')
      .eq('id', attemptId)
      .maybeSingle();
    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!row) return json({ error: 'Attempt not found' }, 404);

    const typed = row as {
      id: string;
      user_id: string;
      transcript: unknown;
      interview_typology_context?: string | null;
      ego_development_level?: number | null;
    };
    if (typed.ego_development_level != null && Number.isFinite(typed.ego_development_level)) {
      return json({ ok: true, ego: typed.ego_development_level, skipped: 'already_set' });
    }

    const transcript = Array.isArray(typed.transcript)
      ? (typed.transcript as Array<{
          role: string;
          content?: string;
          scenarioNumber?: number | null;
          interviewMoment?: number;
        }>)
      : [];

    const out = await repairInterviewAttemptEgoCore({
      supabase: admin,
      attemptId: typed.id,
      userId: typed.user_id,
      transcript,
      typologyContext: typeof typed.interview_typology_context === 'string' ? typed.interview_typology_context : '',
    });

    if (!out.ok) {
      return json({ ok: false, ego: null, error: out.error, skipped: out.skipped }, out.skipped ? 200 : 500);
    }
    return json({ ok: true, ego: out.ego });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
