-- Narrative generation failures were persisted with `reasoning_pending = true`, which blocked admin
-- "Recalculate Scores" even though pillar scores and transcript were already saved.
-- Terminal failure stubs carry these notes; clear the column so the dashboard matches client/edge behavior going forward.
UPDATE public.interview_attempts
SET reasoning_pending = false
WHERE reasoning_pending = true
  AND completed_at IS NOT NULL
  AND (ai_reasoning->>'_reasoningPending') = 'true'
  AND (
    ai_reasoning->>'note' ILIKE '%Narrative AI reasoning failed or timed out%'
    OR ai_reasoning->>'note' ILIKE '%not generated in this session%'
  );
