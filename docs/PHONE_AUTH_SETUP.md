# Phone authentication (Supabase SMS)

Amoraea sign-up and sign-in use **phone number + password**, with **SMS OTP** for verification instead of email confirmation links.

## What you need to do in Supabase

### 1. Enable phone auth

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**.
2. Enable **Phone**.
3. Choose an SMS provider:
   - **Twilio** (recommended for production US numbers)
   - **MessageBird**, **Vonage**, or **Textlocal** (alternatives)
   - **Supabase test OTP** (development only — fixed codes, no real SMS)

### 2. Configure Twilio (typical production setup)

1. Create a [Twilio](https://www.twilio.com/) account.
2. Buy or verify a **US phone number** that supports SMS.
3. In Supabase → **Authentication** → **Providers** → **Phone**:
   - Prefer **Twilio Verify** (more reliable than plain Twilio Messaging in Supabase).
   - **Account SID**
   - **Auth Token**
   - **Verify Service SID** (Twilio Verify) or **Message Service SID** / **From number** (plain Twilio)
4. Save.

#### Twilio trial accounts (common reason texts never arrive)

On a **trial** Twilio account, SMS only delivers to phone numbers you add under **Twilio Console → Phone Numbers → Manage → Verified caller IDs**. Add your real mobile number there, then retry signup / link-phone.

Until you upgrade Twilio or verify the destination number, Supabase may accept the request but Twilio will not deliver the text.

### 3. SMS template (required for Twilio branding / 30475)

The OTP body must name **Amoraea**. Repo default (`supabase/config.toml` `[auth.sms]` and `[auth.mfa.phone]`):

```
Your Amoraea verification code is: {{ .Code }}
```

**Hosted production is not driven by this file.** Paste the same string in:

1. **Supabase Dashboard** → **Authentication** → **SMS Templates** (Twilio Messaging / GoTrue `auth.sms.template`)
2. **Twilio Console** → **Verify** → your Verify service → **Templates**, if the project uses **Twilio Verify** instead of plain Messaging

Sign-up still sends OTP through Supabase (`signUpWithPhone` / `signInWithOtp`); the app does not set the SMS body in JavaScript.

Register requires an **unchecked-by-default** one-time verification SMS checkbox (separate from optional marketing SMS). Create Account stays disabled until that box and the other required fields are complete.

### 4. Auth settings

- **Authentication** → **Settings**:
  - Confirm **Enable phone confirmations** is on (users must enter the SMS code).
  - Set sensible **rate limits** for SMS sends (Supabase enforces defaults; adjust if needed).
- **Phone** provider: allow **sign-ups** if you want new accounts via phone (required for this app).

### 5. Run the DB migration

Apply the new `users.phone` column:

```powershell
npx supabase db push
```

Or run migration `20260802120000_users_auth_phone.sql` in the SQL editor.

### 6. Development / testing without real SMS

Supabase supports **test phone numbers** that bypass Twilio entirely:

1. **Authentication** → **Providers** → **Phone**
2. Scroll to **Test phone numbers and OTPs**
3. Add your number in E.164 form + a fixed 6-digit code (e.g. `+12025551234` → `123456`)
4. Use that exact number in the app; enter the fixed code on the verify screen.

No Twilio charges; no real SMS is sent. Fake `555` numbers sent through Twilio will fail with `sms_send_failed` / invalid number.

Check delivery issues in **Authentication → Logs** (filter for SMS/OTP) and in the **Twilio** message or Verify logs.

## App flows

| Flow | Screen | Behavior |
|------|--------|----------|
| New account | Register | Phone + password → SMS code → verified session |
| Sign in | Login | Phone + password |
| Existing email account | Login → **Log in with email** | Email + password + new phone → SMS code → sign in with phone next time |
| Forgot password | Forgot password | Phone → SMS code → new password |

## Legacy email users

Users who registered with email must use **Log in with email** once to attach and verify a phone number. After that, they sign in with **phone + password** on the main login screen.

Admin (`admin@amoraea.com`) and other email-only accounts continue to work via the link-phone path until a phone is linked.

## Troubleshooting

| Issue | Check |
|-------|--------|
| No SMS received | Twilio trial → verify destination number; or use Supabase **test OTP** numbers; check Auth logs + Twilio logs |
| `sms_send_failed` in app | Twilio rejected send (invalid/unverified number, bad credentials); message now shown on Register / Link phone |
| Twilio error 21211 | Number invalid for Twilio (use real mobile or a Supabase test OTP entry, not fake 555 numbers) |
| Twilio error 21608 / unverified | Trial account — add your phone under Twilio **Verified caller IDs** |
| `Phone not confirmed` | User must enter OTP from register or resend code on login |
| `Invalid phone number` | Use US numbers with area code, or include `+1` country code |
| Rate limit errors | Wait 60s between resends; check Supabase SMS rate limits |
| `Phone provider not configured` | Phone provider disabled or missing Twilio keys in dashboard |

## Cost note

Twilio charges per SMS segment. Monitor usage in Twilio console and set billing alerts.
