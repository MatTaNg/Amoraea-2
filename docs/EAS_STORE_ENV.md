# EAS store builds — environment & secrets

Native iOS/Android builds use **EAS Environment Variables**, not secrets pasted into `eas.json`.

`eas.json` only defines build/submit profiles. Each profile sets `"environment": "development" | "preview" | "production"` so EAS injects the matching project env vars at build time.

## Required client vars (all three EAS environments)

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS still applies) |
| `EXPO_PUBLIC_ANTHROPIC_PROXY_URL` | Prefer `…/functions/v1/anthropic-proxy` |

Optional (same as PWA): auth redirects, Audos, `EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL`, `EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL`.

**Interviewer voice (ElevenLabs Jessica):** iOS native uses warm ElevenLabs MP3 by default when Supabase URL is set (proxy derived automatically). Set `EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK=0` only if TTS routes to the earpiece after mic capture.

## Never put these in EAS as `EXPO_PUBLIC_*`

They ship inside the app binary / JS bundle and can be extracted:

| Variable | Use instead |
|----------|-------------|
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Supabase secret `ANTHROPIC_API_KEY` + `anthropic-proxy` |
| `EXPO_PUBLIC_OPENAI_API_KEY` | Supabase secret `OPENAI_API_KEY` + whisper/chat proxies |
| `EXPO_PUBLIC_ELEVENLABS_API_KEY` | Supabase secret `ELEVENLABS_API_KEY` + `elevenlabs-tts-proxy` |
| `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Scripts / server only |

## Push / update vars

From a machine that has a local `.env` (gitignored):

```powershell
# Example — one var, all environments
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co" --environment production --environment preview --environment development --visibility plaintext --non-interactive --force
```

Or re-run the helper:

```powershell
node scripts/push-eas-public-env.cjs
```

List without printing secret values:

```powershell
eas env:list --environment production
eas env:list --environment preview
eas env:list --environment development
```

## Key rotation (required after keys were ever in `eas.json`)

Anything that lived in the old `eas.json` `env` blocks should be treated as **compromised**:

1. **Anthropic** — create a new API key; set Supabase secret `ANTHROPIC_API_KEY`; revoke the old key.
2. **OpenAI** — rotate; set Supabase `OPENAI_API_KEY`; revoke old.
3. **ElevenLabs** — rotate; set Supabase `ELEVENLABS_API_KEY`; revoke old.
4. **Supabase anon key** — optional rotate in Supabase dashboard if you want a clean break (update EAS + Netlify + local `.env`).
5. Confirm **no** `EXPO_PUBLIC_*_API_KEY` remains in EAS env lists or Netlify.

Provider keys for Edge Functions:

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=... ELEVENLABS_API_KEY=... --project-ref YOUR_PROJECT_REF
```

## Build

```powershell
eas build --platform all --profile production
```

Production profile uses EAS environment `production` and Android `app-bundle` for Play Store.
