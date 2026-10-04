-- Matching outcome instrumentation (collection only; do not auto-train from these rows).

CREATE TABLE IF NOT EXISTS public.match_outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  other_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stage text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  instrumentation_version text NOT NULL DEFAULT 'outcome_v1_2026_08',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_outcome_events_user_idx
  ON public.match_outcome_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS match_outcome_events_pair_idx
  ON public.match_outcome_events (user_id, other_user_id, stage);

ALTER TABLE public.match_outcome_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_outcome_events_self_select ON public.match_outcome_events;
CREATE POLICY match_outcome_events_self_select
  ON public.match_outcome_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_amoraea_admin());

DROP POLICY IF EXISTS match_outcome_events_self_insert ON public.match_outcome_events;
CREATE POLICY match_outcome_events_self_insert
  ON public.match_outcome_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_amoraea_admin());

COMMENT ON TABLE public.match_outcome_events IS
  'Match funnel stages from shown through 12-month follow-up. Collection only — do not auto-train ranking from these rows.';

CREATE TABLE IF NOT EXISTS public.post_date_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  other_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attraction smallint,
  chemistry smallint,
  conversation_ease smallint,
  felt_understood smallint,
  comfort_safety smallint,
  curiosity_to_know_more smallint,
  romantic_interest smallint,
  desire_for_another_date smallint,
  wanted_second_date boolean,
  notes text,
  instrumentation_version text NOT NULL DEFAULT 'outcome_v1_2026_08',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_date_feedback_user_idx
  ON public.post_date_feedback (user_id, created_at DESC);

ALTER TABLE public.post_date_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_date_feedback_self_select ON public.post_date_feedback;
CREATE POLICY post_date_feedback_self_select
  ON public.post_date_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_amoraea_admin());

DROP POLICY IF EXISTS post_date_feedback_self_insert ON public.post_date_feedback;
CREATE POLICY post_date_feedback_self_insert
  ON public.post_date_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_amoraea_admin());

COMMENT ON TABLE public.post_date_feedback IS
  'Post-date feedback dimensions. Collection only — do not auto-train ranking from these rows.';
