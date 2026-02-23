# Anthropic proxy (fixes CORS on web)

The browser blocks direct calls to `api.anthropic.com` from your app (CORS). This Edge Function forwards requests from your app to Anthropic with the API key stored server-side.

---

## Option 1: Deploy from Supabase Dashboard (no CLI)

1. **Open your project** at [supabase.com/dashboard](https://supabase.com/dashboard) → select your project.

2. **Create the Edge Function**
   - Left sidebar → **Edge Functions** → **Create a new function**.
   - Name: `anthropic-proxy`.
   - Replace the default code with the contents of `supabase/functions/anthropic-proxy/index.ts` in this repo, then **Deploy**.

3. **Set the Anthropic API key as a secret (required)**
   - In Supabase: **Project Settings** (gear icon) → **Edge Functions** → **Secrets**.
   - Click **Add new secret**.
   - **Name:** exactly `ANTHROPIC_API_KEY` (no spaces, same spelling).
   - **Value:** paste your Anthropic API key from [console.anthropic.com](https://console.anthropic.com) (it starts with `sk-ant-api03-...`). No quotes, no extra spaces at the start or end.
   - Save. Then **redeploy** the function (e.g. edit and Deploy again) so it picks up the new secret.

4. **Copy the function URL**
   - In **Edge Functions**, open `anthropic-proxy` and copy the URL, e.g.  
     `https://oniyjruvwnfzgbbpoibx.supabase.co/functions/v1/anthropic-proxy`

5. **Configure the app**
   - In your project `.env` add (use your own project ref and function name if different):
     ```
     EXPO_PUBLIC_ANTHROPIC_PROXY_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/anthropic-proxy
     ```
   - The app already sends your Supabase anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) as `Authorization: Bearer ...` when calling this URL — required so Supabase doesn’t return 401.
   - Restart the Expo dev server.

---

## Option 2: Deploy with Supabase CLI (using npx, no global install)

From the project root (`c:\amoraea`):

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key
npx supabase functions deploy anthropic-proxy
```

Then add `EXPO_PUBLIC_ANTHROPIC_PROXY_URL` to `.env` as in step 5 above and restart Expo.

**Note:** `npm install -g supabase` is not supported. Use `npx supabase` or install the CLI via [Scoop](https://scoop.sh/) / [Windows binary](https://github.com/supabase/cli/releases) if you prefer.

---

After this, typed and voice replies go through the proxy and the "I lost the thread" / CORS errors should stop.
