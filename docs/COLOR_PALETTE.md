# Amoraea color palette & design tokens

Use this document as **attachable context** when asking Claude (or Cursor Agent) to design UI, write styles, or match Amoraea's visual language.

Amoraea is a **dark, cinematic** product UI: deep void backgrounds, cool blue "flame" accents, serif display type for voice/emotion, sans-serif for UI chrome.

---


Task: Landing email capture for Amoraea (Amoraea app side is ready)

Goal: User submits email on the landing page → they receive an email → link opens Amoraea registration → after phone signup their landing email is linked to their account.

API — create lead (call from landing backend or serverless, NOT browser with service role):

POST https://oniyjruvwnfzgbbpoibx.supabase.co/functions/v1/create-signup-lead
Headers:
  Content-Type: application/json
  Authorization: Bearer <SUPABASE_ANON_KEY>
  apikey: <SUPABASE_ANON_KEY>
  x-signup-lead-secret: <SIGNUP_LEAD_CREATE_SECRET>   # required in production if Amoraea set this secret
Body:
  { "email": "user@example.com" }

Success response (200):
  { "ok": true, "token": "<url-safe-token>" }

If email was already converted to an account:
  { "ok": true }   // no token — still show generic success UI

Error response (400):
  { "error": "Invalid email address" }

Email link to send:
  https://www.amoraea.com/register?lead=<token>

Rules:
- Do NOT create Supabase Auth users at email capture time
- Do NOT write to public.users or public.profiles
- Do NOT put SUPABASE_SERVICE_ROLE_KEY in the browser
- Always show the same success message after submit (avoid email enumeration)
- Send email from server-side (Resend/SendGrid or a landing API route), not from client with secrets
- Token expires in 30 days; resubmitting the same email rotates the token for unclaimed leads

Landing env vars:
  SUPABASE_URL=https://oniyjruvwnfzgbbpoibx.supabase.co
  SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
  SIGNUP_LEAD_CREATE_SECRET=<SIGNUP_LEAD_CREATE_SECRET>        # match Amoraea Supabase secret
  APP_REGISTER_BASE_URL=https://www.amoraea.com/register
  RESEND_API_KEY=<RESEND_API_KEY>                   # if landing sends email itself
  EMAIL_FROM=admin@contact.amoraea.com

Acceptance checklist:
- [ ] Valid email → 200 with token
- [ ] Email sent with link https://www.amoraea.com/register?lead=<token>
- [ ] Link opens Amoraea register screen
- [ ] After phone OTP signup, public.users.email is populated (Amoraea handles claim automatically)
- [ ] Invalid email rejected cleanly
- [ ] No service role key in client bundle

## 1. Brand concept

| Concept | Meaning |
|--------|---------|
| **Void** | Deep near-black backgrounds (`#05060D`) |
| **Flame** | Cool blue accent ladder from deep (`#1E6FD9`) to bright (`#C8E4FF`) — not orange/red |
| **Glass** | Low-opacity white/blue overlays on dark surfaces |
| **Voice** | Cormorant Garamond for Amoraea / display copy |
| **UI** | Jost for buttons, labels, admin chrome; DM Sans for forms/profile |

---

## 2. Primary palette (use this for new UI)

### Backgrounds & surfaces

| Token | Hex / value | Use |
|-------|-------------|-----|
| `void` | `#05060D` | Main app background (auth, interview, admin shell, psychometrics) |
| `voidPostInterview` | `#0a0a0f` | Post-interview onboarding stack |
| `surface` | `#0D1120` | Panels, inputs, stage score containers |
| `surfaceElevated` | `#0f1419` | Cards, bottom sheets (`theme.colors.card`) |
| `surfaceCard` | `#111827` | Score cards, admin transcript cards |
| `surfaceTranslucent` | `rgba(13,17,32,0.9)` | Auth inputs, floating panels |
| `overlay` | `rgba(5,6,13,0.96)` | Full-screen modals (session expired, etc.) |

### Flame blues (brand accent)

| Token | Hex | Use |
|-------|-----|-----|
| `flameDeep` | `#1E6FD9` | Strong accent: bullets, tip borders, button shadows, left borders |
| `flameMid` | `#5BA8E8` | **Primary brand color**: buttons, links, icons, active tabs |
| `flameBright` | `#C8E4FF` | Wordmarks, interviewer transcript, section titles |
| `flameSky` | `#528EDC` | Secondary blue (e.g. demographics "Man") |
| `textOnPrimary` | `#EEF6FF` | Text on blue buttons |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `textPrimary` | `#E8F0F8` | Body copy, user transcript |
| `textBright` | `#F4F8FC` | Strong headings |
| `textDisplay` | `#EEF6FF` | Button labels on primary actions |
| `textSecondary` | `#7A9ABE` | Subtitles, metadata, helper text |
| `textDim` | `#3D5470` | Footer, placeholders, waiting/idle states |
| `textMuted` | `#B8C9DC` | De-emphasized inline copy |

### Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `success` | `#2A8C6A` | Pass, gate success, calibrated disclosure, bookmarks on |
| `error` | `#E87A7A` | Errors, fail states, negative modifiers |
| `errorAlt` | `#f87171` | Form validation, post-interview errors |
| `warning` | `#D4A84B` | Underdisclosure, caution |
| `warningChart` | `#E8B84A` | Age distribution bars |
| `destructiveSoft` | `#E8A0A0` | Destructive admin actions (reset) |

### Borders, glass & effects

| Token | Value | Use |
|-------|-------|-----|
| `borderDefault` | `rgba(82,142,220,0.15)` | Inputs, dividers |
| `borderSubtle` | `rgba(82,142,220,0.12)` | Admin cards, transcript separators |
| `borderStrong` | `rgba(82,142,220,0.25–0.35)` | Highlighted panels, demographics banner |
| `glassBg` | `rgba(255,255,255,0.06)` | Frosted panels |
| `glassBorder` | `rgba(255,255,255,0.12)` | Frosted panel edges |
| `tipCardBg` | `rgba(30,111,217,0.12)` | Info/tip callouts |
| `buttonTintBg` | `rgba(30,111,217,0.1)` | Ghost buttons (back, logout, admin bar) |
| `ambientGlow` | `rgba(30,111,217,0.09)` | Auth screen radial glow |
| `shadowBlue` | `rgba(30,111,217,0.25)` | Primary button shadow |
| `errorTintBg` | `rgba(184,92,92,0.12)` | Destructive button background |
| `errorTintBorder` | `rgba(232,120,120,0.35)` | Destructive button border |
| `errorMessageBg` | `rgba(232,122,122,0.08)` | Inline error bubbles |

---

## 3. Data visualization & admin accents

| Token | Hex | Use |
|-------|-----|-----|
| `chartMan` | `#528EDC` | Gender: Man |
| `chartWoman` | `#C87AD8` | Gender: Woman |
| `chartNonBinary` | `#2A8C6A` | Gender: Non-binary |
| `chartUnknown` | `#5C7A9E` | Gender: Unknown |
| `chartAge` | `#E8B84A` | Age buckets |
| `analyticsGreen` | `#22c55e` | Overview pass / high correlation |
| `analyticsRed` | `#ef4444` | Overview fail |
| `analyticsAmber` | `#f59e0b` | Flip warnings, low variance |
| `analyticsIndigo` | `#6366f1` | Score means (admin charts) |
| `analyticsPurple` | `#8b5cf6` | Survey / typology bars |

---

## 4. Typography

| Role | Font stack (web) | Native |
|------|------------------|--------|
| Display / voice | `'Cormorant Garamond', serif` | System serif fallback |
| UI / chrome | `'Jost', sans-serif` | System sans fallback |
| Body / forms | `'DM Sans', system-ui, sans-serif` | System sans fallback |
| Monospace | `monospace` | Admin score JSON dumps |

Google Fonts URL (psychometrics + profile):

```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap
```

Interview layout also loads Jost (200–500).

---

## 5. Copy-paste JSON (for Claude prompts)

```json
{
  "brand": "Amoraea",
  "theme": "dark",
  "backgrounds": {
    "void": "#05060D",
    "voidPostInterview": "#0a0a0f",
    "surface": "#0D1120",
    "surfaceElevated": "#0f1419",
    "surfaceCard": "#111827"
  },
  "flame": {
    "deep": "#1E6FD9",
    "mid": "#5BA8E8",
    "bright": "#C8E4FF",
    "sky": "#528EDC"
  },
  "text": {
    "primary": "#E8F0F8",
    "bright": "#F4F8FC",
    "onPrimary": "#EEF6FF",
    "secondary": "#7A9ABE",
    "dim": "#3D5470",
    "muted": "#B8C9DC"
  },
  "semantic": {
    "success": "#2A8C6A",
    "error": "#E87A7A",
    "errorAlt": "#f87171",
    "warning": "#D4A84B",
    "warningChart": "#E8B84A",
    "destructiveSoft": "#E8A0A0"
  },
  "borders": {
    "default": "rgba(82,142,220,0.15)",
    "subtle": "rgba(82,142,220,0.12)",
    "strong": "rgba(82,142,220,0.35)",
    "glassBg": "rgba(255,255,255,0.06)",
    "glassBorder": "rgba(255,255,255,0.12)",
    "tipCardBg": "rgba(30,111,217,0.12)"
  },
  "charts": {
    "man": "#528EDC",
    "woman": "#C87AD8",
    "nonBinary": "#2A8C6A",
    "unknown": "#5C7A9E",
    "age": "#E8B84A",
    "pass": "#22c55e",
    "fail": "#ef4444",
    "caution": "#f59e0b"
  },
  "fonts": {
    "display": "Cormorant Garamond",
    "ui": "Jost",
    "body": "DM Sans"
  }
}
```

---

## 6. CSS custom properties (optional web scaffold)

```css
:root {
  --amoraea-void: #05060D;
  --amoraea-void-post: #0a0a0f;
  --amoraea-surface: #0D1120;
  --amoraea-surface-elevated: #0f1419;
  --amoraea-surface-card: #111827;

  --amoraea-flame-deep: #1E6FD9;
  --amoraea-flame-mid: #5BA8E8;
  --amoraea-flame-bright: #C8E4FF;

  --amoraea-text-primary: #E8F0F8;
  --amoraea-text-secondary: #7A9ABE;
  --amoraea-text-dim: #3D5470;
  --amoraea-text-on-primary: #EEF6FF;

  --amoraea-success: #2A8C6A;
  --amoraea-error: #E87A7A;
  --amoraea-warning: #D4A84B;

  --amoraea-border: rgba(82, 142, 220, 0.15);
  --amoraea-glass-bg: rgba(255, 255, 255, 0.06);
  --amoraea-glass-border: rgba(255, 255, 255, 0.12);

  --amoraea-font-display: 'Cormorant Garamond', serif;
  --amoraea-font-ui: 'Jost', sans-serif;
  --amoraea-font-body: 'DM Sans', system-ui, sans-serif;
}
```

---

## 7. UI patterns (for matching existing screens)

- **Primary button:** `#5BA8E8` fill, `#EEF6FF` uppercase label (11px, letter-spacing 2.5), radius 10, blue shadow
- **Ghost button:** `rgba(30,111,217,0.1)` bg, `rgba(82,142,220,0.2)` border, `#5BA8E8` text
- **Input:** `#0D1120` or translucent surface, `rgba(82,142,220,0.15)` border, `#E8F0F8` text
- **Interviewer transcript:** `#C8E4FF`, Cormorant Garamond, italic, left border `rgba(82,142,220,0.12)`
- **User transcript:** `#E8F0F8`, Jost, regular weight
- **Section labels (admin):** `#3D5470`, 9–10px, uppercase, letter-spacing 2–2.5
- **Info banner:** `rgba(30,111,217,0.12)` bg, `rgba(82,142,220,0.35)` border, radius 12

---

## 8. Legacy palette (avoid for new screens)

`src/ui/theme/colors.ts` still exports a **light indigo/purple** starter theme (`#6366F1`, white background). Some older shared components import it. **Prefer the dark palette above** for all user-facing Amoraea UI.

| Legacy token | Hex |
|--------------|-----|
| primary | `#6366F1` |
| secondary | `#8B5CF6` |
| accent | `#EC4899` |
| background | `#FFFFFF` |
| surface | `#F9FAFB` |

---

## 9. Source files in repo

| File | Contents |
|------|----------|
| `src/app/screens/authStyles.ts` | Canonical named tokens (BG, FLAME_*, TEXT_*) |
| `src/shared/theme/theme.ts` | Shared dark theme subset |
| `src/features/psychometrics/psychometricsTheme.ts` | Psychometrics + glass tokens |
| `src/features/aria/styles/ariaAdminInterviewStyles.ts` | Admin interview dark system |
| `src/features/aria/styles/ariaPreInterviewStyles.ts` | Pre-interview screen colors |
| `src/ui/theme/colors.ts` | Legacy light palette |

---

## 10. Instructions for Claude

When generating Amoraea UI:

1. Default to **dark mode** with `#05060D` background.
2. Use **blue flame accents** (`#5BA8E8`, `#1E6FD9`, `#C8E4FF`) — not warm orange/red for brand elements.
3. Use **Cormorant Garamond** for Amoraea's voice and emotional/display copy; **Jost** for UI; **DM Sans** for forms.
4. Reserve **green `#2A8C6A`** for success/pass and **soft red `#E87A7A`** for errors/fail.
5. Borders are **translucent blue**, not gray — `rgba(82,142,220,0.12–0.35)`.
6. Do not introduce new user-visible strings with "Aria" — the product voice is **Amoraea**.
