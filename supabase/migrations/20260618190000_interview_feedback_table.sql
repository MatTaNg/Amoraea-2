-- User-submitted interview feedback; insert open for all roles; read for service role and Amoraea app admin.
CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  attempt_id      uuid references public.interview_attempts (id) on delete set null,
  user_id         uuid references auth.users (id) on delete set null,
  category        text,
  message         text not null,
  rating          smallint,
  page_context    text,
  user_agent      text
);

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS "admin_read_feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS "admin_read_feedback_app" ON public.interview_feedback;

CREATE POLICY "insert_feedback" ON public.interview_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_read_feedback" ON public.interview_feedback
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "admin_read_feedback_app" ON public.interview_feedback
  FOR SELECT TO authenticated
  USING (public.is_amoraea_admin());
