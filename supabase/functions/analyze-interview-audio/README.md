# analyze-interview-audio

Processes interview audio per turn and finalizes session-level averages.

## Request

`POST` JSON body for turn processing:

```json
{
  "action": "process_turn",
  "user_id": "<uuid>",
  "session_id": "<string>",
  "turn_index": 0,
  "scenario_number": 1,
  "audio_duration_seconds": 4.2,
  "mime_type": "audio/mp4",
  "audio_base64": "<base64>"
}
```

Finalize payload:

```json
{
  "action": "finalize_session",
  "user_id": "<uuid>",
  "attempt_id": "<uuid>",
  "session_id": "<string>"
}
```

## Behavior

- Turn mode writes per-turn rows to `interview_turn_audio_features`
- Finalize mode averages successful turns (duration-weighted) into `communication_style_profiles`
- Logs processing status/errors in `style_processing_log`
- Removes temporary uploaded objects from Storage on every request
- Fails gracefully: sets `audio_confidence = 0` and never blocks interview completion path

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HUME_API_KEY` (optional for graceful degradation; without it audio analysis becomes partial with confidence 0)

