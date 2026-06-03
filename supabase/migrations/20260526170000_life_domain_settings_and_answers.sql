-- Life domain importance + optional deep-dive answers (edit profile + onboarding).

CREATE TABLE IF NOT EXISTS public.life_domain_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  domain_id text NOT NULL,
  importance int NOT NULL DEFAULT 50 CHECK (importance >= 0 AND importance <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT life_domain_settings_user_domain UNIQUE (user_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_life_domain_settings_user ON public.life_domain_settings (user_id);

ALTER TABLE public.life_domain_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS life_domain_settings_select_own ON public.life_domain_settings;
CREATE POLICY life_domain_settings_select_own
  ON public.life_domain_settings FOR SELECT
  USING (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_settings_insert_own ON public.life_domain_settings;
CREATE POLICY life_domain_settings_insert_own
  ON public.life_domain_settings FOR INSERT
  WITH CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_settings_update_own ON public.life_domain_settings;
CREATE POLICY life_domain_settings_update_own
  ON public.life_domain_settings FOR UPDATE
  USING (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_settings_delete_own ON public.life_domain_settings;
CREATE POLICY life_domain_settings_delete_own
  ON public.life_domain_settings FOR DELETE
  USING (auth.uid () = user_id);

CREATE TABLE IF NOT EXISTS public.life_domain_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  domain_id text NOT NULL,
  question_id text NOT NULL,
  answer text,
  show_on_match boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT life_domain_answers_user_domain_q UNIQUE (user_id, domain_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_life_domain_answers_user ON public.life_domain_answers (user_id);

ALTER TABLE public.life_domain_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS life_domain_answers_select_own ON public.life_domain_answers;
CREATE POLICY life_domain_answers_select_own
  ON public.life_domain_answers FOR SELECT
  USING (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_answers_insert_own ON public.life_domain_answers;
CREATE POLICY life_domain_answers_insert_own
  ON public.life_domain_answers FOR INSERT
  WITH CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_answers_update_own ON public.life_domain_answers;
CREATE POLICY life_domain_answers_update_own
  ON public.life_domain_answers FOR UPDATE
  USING (auth.uid () = user_id);

DROP POLICY IF EXISTS life_domain_answers_delete_own ON public.life_domain_answers;
CREATE POLICY life_domain_answers_delete_own
  ON public.life_domain_answers FOR DELETE
  USING (auth.uid () = user_id);
