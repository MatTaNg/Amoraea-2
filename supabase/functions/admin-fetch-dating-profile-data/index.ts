import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Must match admin gate in app (AdminInterviewDashboard, AriaScreen). */
const ADMIN_EMAIL = 'admin@amoraea.com';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

type AssessmentRow = {
  instrument: string;
  scores: unknown;
  completed_at: string | null;
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerErr,
  } = await userClient.auth.getUser();
  if (callerErr || !caller?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (caller.email.toLowerCase() !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId.trim()
      : '';
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [assessmentsRes, progressRes, photosRes] = await Promise.all([
    admin
      .from('user_assessments')
      .select('instrument, scores, completed_at')
      .eq('user_id', userId),
    admin
      .from('onboarding_progress')
      .select('current_step, completed_steps, updated_at, onboarding_data')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('profile_photos')
      .select('public_url, display_order')
      .eq('profile_id', userId)
      .order('display_order', { ascending: true }),
  ]);

  const warnings: string[] = [];
  if (assessmentsRes.error) warnings.push(`user_assessments: ${assessmentsRes.error.message}`);
  if (progressRes.error) warnings.push(`onboarding_progress: ${progressRes.error.message}`);
  if (photosRes.error) warnings.push(`profile_photos: ${photosRes.error.message}`);

  return new Response(
    JSON.stringify({
      assessments: (assessmentsRes.data ?? []) as AssessmentRow[],
      onboarding_progress: progressRes.data ?? null,
      profile_photos: photosRes.data ?? [],
      warnings,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
