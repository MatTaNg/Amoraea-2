export async function sendResultsEmail(params: {
  toEmail: string;
  userName: string | null;
}): Promise<void> {
  const { toEmail, userName } = params;

  const firstName = userName?.trim() || null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#070A14;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#0B1021 0%,#070A14 100%);padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#10162A;border:1px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:34px 40px 26px 40px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#95A4C7;">Amoraea</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:34px 40px 36px 40px;">
              <p style="margin:0 0 16px 0;font-size:18px;line-height:1.6;color:#F3F7FF;">${greeting}</p>
              <p style="margin:0 0 14px 0;font-size:20px;line-height:1.45;color:#FFFFFF;font-weight:500;">Your Amoraea results are ready.</p>
              <p style="margin:0 0 30px 0;font-size:15px;line-height:1.75;color:#B9C6E3;">
                Open your dashboard to view your outcomes and recommended next steps.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:999px;background:linear-gradient(135deg,#6C8BFF 0%,#4F66C8 100%);">
                    <a href="https://www.amoraea.com" 
                       style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;letter-spacing:0.2px;">
                      View My Results
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 40px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:11px;color:#7F90B6;line-height:1.7;">
                You received this email because you completed an interview on Amoraea.<br>
                <a href="https://www.amoraea.com" style="color:#9FB0D9;">www.amoraea.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textBody = `${greeting}

Your Amoraea results are ready.

Open your dashboard to view your outcomes and recommended next steps.

https://www.amoraea.com

---
You received this email because you completed an interview on Amoraea.`;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (!RESEND_API_KEY) {
    console.error('[ResultsEmail] RESEND_API_KEY not set — skipping email');
    return;
  }

  const from =
    (Deno.env.get('RESEND_FROM') ?? '').trim() || 'Amoraea <results@amoraea.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: 'Your Amoraea results are ready',
      html: htmlBody,
      text: textBody,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ResultsEmail] Resend API error:', error);
    throw new Error(`Failed to send results email: ${response.status} ${error}`);
  }

  console.log('[ResultsEmail] sent successfully to:', toEmail);
}
