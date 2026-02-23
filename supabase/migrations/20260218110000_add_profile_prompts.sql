-- Add profile prompts (Hinge-style) for UX display only; not used by matching algorithm.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_prompts JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN users.profile_prompts IS 'Array of { promptId: string, answer: string }, max 3. For display only.';
