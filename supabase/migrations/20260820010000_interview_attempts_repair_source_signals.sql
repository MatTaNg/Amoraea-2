-- Distinguishable repair source signals (hypothetical / autobiographical / spontaneous).
-- Collection for validation analytics. Does not change the Repair pillar formula.

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS repair_source_signals jsonb;

COMMENT ON COLUMN public.interview_attempts.repair_source_signals IS
  'hypothetical_repair (S3), autobiographical_repair (M5), spontaneous_repair (S1/S2). Rolled into the single Repair pillar separately. Disagreement is preserved for later outcome validation — do not auto-penalize.';
