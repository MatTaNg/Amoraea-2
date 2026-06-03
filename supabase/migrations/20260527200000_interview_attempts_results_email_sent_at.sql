-- Track transactional "results ready" email per interview attempt (idempotent send).
alter table public.interview_attempts
  add column if not exists results_email_sent_at timestamptz default null;

comment on column public.interview_attempts.results_email_sent_at is
  'When the post-scoring results-ready transactional email was sent for this attempt.';
