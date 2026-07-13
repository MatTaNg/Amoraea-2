# PWA Setup & Netlify Deployment

Amoraea ships as an installable Progressive Web App hosted on **Netlify** ([project dashboard](https://app.netlify.com/projects/superlative-pasca-129bb2/overview)). Users on iPhone and Android can add it to their home screen and launch it full-screen.

Backend AI (reports, interview transcription, TTS) runs through **Supabase Edge Functions** with API keys stored as **Supabase secrets** — not in the Netlify bundle.

## Icons

Copy all icons from your `pwa_icons/` folder into `public/icons/` (see `public/icons/README.md` for the list). Until then, the app runs normally; install prompts may use fallbacks.

## Build & Deploy

### Local build (manual upload)

1. `npm run build:web` → output in `dist/`
2. Upload `dist/` via Netlify **Deploys → Upload a file** (see root `README.md`)

### Continuous deploy (recommended)

`netlify.toml` is already configured:

- **Build command:** `npm run build:web`
- **Publish directory:** `dist`
- **SPA redirects:** all routes → `index.html` (email confirm links, deep links)

Connect the Git repo in Netlify or keep using manual uploads; either way, **redeploy after changing environment variables** — Expo inlines `EXPO_PUBLIC_*` at build time.

## Environment variables

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the **browser bundle**. Never put provider API keys in `EXPO_PUBLIC_*` on Netlify — they are extractable from DevTools even if Netlify marks them “secret”.

### Netlify (client / build)

Set these in **Site configuration → Environment variables**:

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (RLS protects data) |
| `EXPO_PUBLIC_ANTHROPIC_PROXY_URL` | Recommended | `https://<project-ref>.supabase.co/functions/v1/anthropic-proxy` |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | Yes (prod) | e.g. `https://www.amoraea.com/auth/callback` |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV` | Optional | Local/preview OAuth callback |
| `EXPO_PUBLIC_AUDOS_*` | Optional | Client analytics if enabled |

Optional (inferred from Supabase URL if omitted):

- `EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL`
- `EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL`

**Do not set on Netlify:**

| Variable | Why |
|----------|-----|
| `EXPO_PUBLIC_OPENAI_API_KEY` | Leaked in JS; use `openai-whisper-proxy` + Supabase secret |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Leaked in JS; use `anthropic-proxy` + Supabase secret |
| `EXPO_PUBLIC_ELEVENLABS_API_KEY` | Leaked in JS; bypasses TTS proxy if set |
| `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — scripts only, never client |

### Supabase (Edge Function secrets)

Set in **Project Settings → Edge Functions → Secrets** (or `npx supabase secrets set ...`):

| Secret | Used by |
|--------|---------|
| `ANTHROPIC_API_KEY` | `anthropic-proxy` (personal + validation reports, AI reasoning) |
| `OPENAI_API_KEY` | `openai-whisper-proxy`, `openai-chat-proxy` |
| `ELEVENLABS_API_KEY` | `elevenlabs-tts-proxy` |
| `RESEND_API_KEY` | Email functions (if deployed) |

Deploy functions after adding secrets:

```powershell
npx supabase functions deploy anthropic-proxy openai-whisper-proxy openai-chat-proxy elevenlabs-tts-proxy --project-ref YOUR_PROJECT_REF
```

No Netlify redeploy is required when only Supabase secrets change.

### Local `.env` (development)

Mirror the same split:

- **`EXPO_PUBLIC_*`** — only what the client may know (Supabase URL/anon, proxy URLs, auth redirects).
- **Without `EXPO_PUBLIC_`** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` for local scripts and optional `supabase functions serve`.

See `supabase/functions/anthropic-proxy/README.md` for proxy setup details.

### Request flow (production)

```
Browser (Netlify static app)
  → Supabase Edge Function URL + anon/session JWT
  → Edge function reads API key from Supabase secrets
  → OpenAI / Anthropic / ElevenLabs
```

## How users install

- **iPhone:** Safari → your URL → Share → Add to Home Screen. Open from home screen for full-screen.
- **Android:** Chrome → your URL → Add to Home Screen / Install.

## iOS behaviour

- **Audio:** Unlocked on first user gesture (tap/click) so Amoraea TTS is not blocked.
- **Microphone:** Permission is requested when the user taps "Start" on the interview intro screen (user gesture required on iOS PWA).
- **Safe areas:** `index.html` and root styles use `env(safe-area-inset-*)` and `100dvh` so content is not hidden behind the notch or home bar.

## Security for Alpha

- **Option A:** Netlify site password / access control (if enabled on your plan).
- **Option B:** Rely on Supabase auth — the app requires login; registration is gated.

## Other hosts

Vercel or any static host can serve `dist/` with the same `EXPO_PUBLIC_*` Netlify list and the same Supabase secrets. This project’s production workflow is **Netlify + Supabase**, not Vercel.

## Native store builds (EAS)

iOS/Android release builds use the same client/proxy split. See [EAS_STORE_ENV.md](./EAS_STORE_ENV.md) — do not put provider API keys in `eas.json` or as `EXPO_PUBLIC_*` on EAS.
