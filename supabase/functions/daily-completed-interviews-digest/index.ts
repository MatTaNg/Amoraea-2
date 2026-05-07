/**
 * Daily email digest of users who completed the gate interview on a given calendar day (UTC).
 *
 * Schedule (Supabase Dashboard → Edge Functions → Schedules, or external cron):
 *   POST https://<project>.supabase.co/functions/v1/daily-completed-interviews-digest
 *   Headers: Authorization: Bearer <CRON_SECRET>  (or x-cron-secret: <CRON_SECRET>)
 *
 * Runs after midnight UTC to cover the previous UTC day, e.g. cron `10 0 * * *` (00:10 UTC daily).
 *
 * Secrets (project settings → Edge Functions):
 *   CRON_SECRET              — required; same pattern as process-deferred-standard-interviews
 *   RESEND_API_KEY           — required to send mail (https://resend.com)
 *   RESEND_FROM              — optional, e.g. "Amoraea <digest@yourdomain.com>" (must be verified on Resend)
 *   DAILY_INTERVIEW_DIGEST_TO — optional recipient; defaults to admin@amoraea.com (see src/constants/adminConsole.ts)
 *   AMORAEA_APP_BASE_URL     — optional; defaults to https://www.amoraea.com (link to open admin panel)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const DEFAULT_DIGEST_TO = 'admin@amoraea.com';
const DEFAULT_APP_BASE = 'https://www.amoraea.com';

function authorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.startsWith('Bearer ')
    ? req.headers.get('authorization')!.slice(7)
    : null;
  if (bearer === secret) return true;
  return req.headers.get('x-cron-secret') === secret;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Previous UTC calendar day relative to `now` (for a job that runs just after midnight UTC). */
function previousUtcDayBounds(now: Date): { label: string; start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayStartUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const dayEnd = todayStartUtc;
  const dayStart = new Date(todayStartUtc.getTime() - 24 * 60 * 60 * 1000);
  const label = dayStart.toISOString().slice(0, 10);
  return { label, start: dayStart, end: dayEnd };
}

/** Explicit YYYY-MM-DD (UTC day). */
function utcDayBoundsFromLabel(label: string): { label: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const start = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, d + 1, 0, 0, 0, 0));
  if (Number.isNaN(start.getTime())) return null;
  return { label: label.trim(), start, end };
}

type DigestUser = {
  id: string;
  email: string | null;
  interview_completed_at: string | null;
  interview_passed: boolean | null;
};

async function sendResendEmail(options: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, error: raw || res.statusText };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let digestBounds = previousUtcDayBounds(new Date());
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const dateStr =
        typeof body === 'object' && body !== null && typeof (body as { date?: unknown }).date === 'string'
          ? (body as { date: string }).date
          : '';
      if (dateStr) {
        const parsed = utcDayBoundsFromLabel(dateStr);
        if (!parsed) {
          return new Response(JSON.stringify({ error: 'Invalid date; use YYYY-MM-DD (UTC)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        digestBounds = parsed;
      }
    } catch {
      /* keep default */
    }
  }

  const resendKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim();
  if (!resendKey) {
    return new Response(
      JSON.stringify({
        error: 'RESEND_API_KEY is not set; add it in Supabase Edge Function secrets to enable email.',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(url, serviceKey);
  const { start, end, label } = digestBounds;

  const { data: rows, error: qErr } = await supabase
    .from('users')
    .select('id, email, interview_completed_at, interview_passed')
    .eq('interview_completed', true)
    .not('interview_completed_at', 'is', null)
    .gte('interview_completed_at', start.toISOString())
    .lt('interview_completed_at', end.toISOString())
    .order('interview_completed_at', { ascending: true });

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const list = (rows ?? []) as DigestUser[];
  const to = (Deno.env.get('DAILY_INTERVIEW_DIGEST_TO') ?? DEFAULT_DIGEST_TO).trim() || DEFAULT_DIGEST_TO;
  const baseUrl = (Deno.env.get('AMORAEA_APP_BASE_URL') ?? DEFAULT_APP_BASE).replace(/\/+$/, '');
  const adminPanelUrl = `${baseUrl}/interview?openAdminPanel=1`;

  const from =
    (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Amoraea <onboarding@resend.dev>';

  const passLabel = (p: boolean | null) =>
    p === true ? 'Pass' : p === false ? 'Fail' : '—';

  const tableRows =
    list.length === 0
      ? '<tr><td colspan="4" style="padding:12px;color:#5a6570;">No completions on this day (UTC).</td></tr>'
      : list
          .map((u) => {
            const em = escapeHtml(u.email ?? '—');
            const completed = u.interview_completed_at
              ? escapeHtml(new Date(u.interview_completed_at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC')
              : '—';
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:14px;">${escapeHtml(u.id)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:14px;">${em}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:14px;">${completed}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eaed;font-size:14px;">${passLabel(u.interview_passed)}</td>
            </tr>`;
          })
          .join('');

  const subject = `Amoraea — ${list.length} interview completion(s) — ${label} (UTC)`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,Segoe UI,sans-serif;background:#f6f7fb;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px 28px;border:1px solid #e8eaed;">
    <h1 style="font-size:18px;margin:0 0 8px;color:#111;">Completed interviews</h1>
    <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.5;">
      <strong>${list.length}</strong> user(s) completed the interview on <strong>${escapeHtml(label)}</strong> (UTC).
    </p>
    <p style="margin:0 0 20px;">
      <a href="${escapeHtml(adminPanelUrl)}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">
        Open admin panel
      </a>
    </p>
    <p style="margin:0 0 12px;color:#666;font-size:13px;">Sign in with your admin account if prompted. The link opens the interview admin dashboard.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f1f3f9;text-align:left;">
          <th style="padding:10px 12px;font-size:12px;color:#555;">User id</th>
          <th style="padding:10px 12px;font-size:12px;color:#555;">Email</th>
          <th style="padding:10px 12px;font-size:12px;color:#555;">Completed (UTC)</th>
          <th style="padding:10px 12px;font-size:12px;color:#555;">Gate</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</body></html>`;

  const textLines = [
    `Amoraea — completed interviews for ${label} (UTC)`,
    `Count: ${list.length}`,
    '',
    `Open admin panel: ${adminPanelUrl}`,
    '',
    ...list.map(
      (u) =>
        `${u.id}\t${u.email ?? '—'}\t${u.interview_completed_at ?? '—'}\t${passLabel(u.interview_passed)}`,
    ),
  ];
  const text = textLines.join('\n');

  const sent = await sendResendEmail({
    apiKey: resendKey,
    from,
    to,
    subject,
    html,
    text,
  });

  if (!sent.ok) {
    return new Response(JSON.stringify({ error: 'Resend failed', detail: sent.error }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      digestDateUtc: label,
      count: list.length,
      emailedTo: to,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
