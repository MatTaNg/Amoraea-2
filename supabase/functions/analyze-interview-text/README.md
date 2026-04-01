# analyze-interview-text

Extracts communication-style text features from the most recent passed `interview_attempts` transcript.

## Request

`POST` JSON body:

```json
{ "user_id": "<uuid>" }
```

## Behavior

- Reads latest passed attempt for user
- Uses user turns only (`role === "user"`)
- Computes style metrics and `text_confidence`
- Upserts `communication_style_profiles`
- Logs to `style_processing_log`

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

