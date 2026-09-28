-- Landing-page email capture → phone signup linking.
-- Raw tokens are never stored; edge functions persist SHA-256 hashes only.

CREATE TABLE IF NOT EXISTS public.signup_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + interval '30 days'),
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS signup_leads_token_hash_idx
  ON public.signup_leads (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS signup_leads_email_unclaimed_idx
  ON public.signup_leads (lower(email))
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS signup_leads_claimed_by_user_id_idx
  ON public.signup_leads (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

COMMENT ON TABLE public.signup_leads IS
  'Emails captured on the marketing landing page; claimed when the user completes phone signup via /register?lead= token.';

ALTER TABLE public.signup_leads ENABLE ROW LEVEL SECURITY;

-- No client policies: access only via service-role edge functions.
