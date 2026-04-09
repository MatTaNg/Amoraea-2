# analyze-interview-text

Extracts communication-style **text** features from an `interview_attempts` transcript and upserts `communication_style_profiles` (one row per `user_id`).

## Deploy (repo root)

```bash
npm run deploy:fn:analyze-interview-text
```

Equivalent:

```bash
npx supabase functions deploy analyze-interview-text
```

Requires [Supabase CLI](https://supabase.com/docs/guides/cli), `npx supabase login`, and `npx supabase link --project-ref <ref>` once per machine.

## Request

`POST` JSON body:

```json
{ "user_id": "<uuid>", "attempt_id": "<uuid optional>" }
```

- If **`attempt_id`** is set, that attempt is loaded (must belong to `user_id`). Used by the app after each completed interview.
- If omitted, the **latest** attempt by `completed_at` for the user is used.

## Response (200)

Includes fields for debugging stale profile rows:

```json
{
  "ok": true,
  "user_id": "...",
  "attempt_id": "...",
  "text_confidence": 1,
  "narrative_conceptual_score": 0.36,
  "user_corpus_char_count": 1234,
  "user_turn_count": 12
}
```

If these fields are **missing** in the client, the deployed function is likely **older** than this branch — redeploy.

## Required secrets (Edge Function)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set in Dashboard → **Project Settings → Edge Functions → Secrets** or `npx supabase secrets set ...`.

## Behavior

- User turns only (`role === "user"`)
- Computes style metrics + `text_confidence`
- Upserts `communication_style_profiles` (including `source_attempt_id`, `matchmaker_summary`, labels)
- Logs to `style_processing_log`
- Server log line: `[analyze-interview-text] response {...}`

## Local serve (optional)

```bash
npx supabase functions serve analyze-interview-text --env-file ./supabase/.env.local
```

(Provide service role in env file; never commit secrets.)
