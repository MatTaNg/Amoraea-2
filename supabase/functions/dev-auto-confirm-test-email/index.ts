import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Must match dev test account in app (devScenarioJumpReferral, LoginScreen prefill). */
const TEST_AUTO_CONFIRM_EMAIL = 'mattang5280@gmail.com';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
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

  const emailRaw =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email.trim().toLowerCase()
      : '';
  const userId =
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId.trim()
      : '';

  if (emailRaw !== TEST_AUTO_CONFIRM_EMAIL) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let targetUserId = userId;
  if (targetUserId) {
    const { data: targetData, error: getErr } = await admin.auth.admin.getUserById(targetUserId);
    if (getErr || !targetData?.user) {
      return new Response(JSON.stringify({ error: getErr?.message ?? 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (targetData.user.email?.trim().toLowerCase() !== TEST_AUTO_CONFIRM_EMAIL) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    let page = 1;
    let found: { id: string } | null = null;
    while (page <= 20 && !found) {
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const match = listData.users.find(
        (u) => u.email?.trim().toLowerCase() === TEST_AUTO_CONFIRM_EMAIL,
      );
      if (match) {
        found = { id: match.id };
        break;
      }
      if (!listData.users.length || listData.users.length < 200) break;
      page += 1;
    }
    if (!found) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    targetUserId = found.id;
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });
  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
