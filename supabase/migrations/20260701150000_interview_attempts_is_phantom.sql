-- Phantom attempts: rows created before first substantive user response (empty transcript, never completed).
-- Preserved for audit; excluded from attempt counting, cooldown, and admin display.

alter table public.interview_attempts
  add column if not exists is_phantom boolean not null default false;

comment on column public.interview_attempts.is_phantom is
  'True when the attempt was created before any substantive user response (empty transcript, never completed). Excluded from attempt_number, cooldown, and admin lists.';

update public.interview_attempts
set is_phantom = true
where completed_at is null
  and (
    transcript is null
    or transcript = '[]'::jsonb
    or (
      jsonb_typeof(transcript) = 'array'
      and jsonb_array_length(transcript) = 0
    )
  );

create index if not exists idx_interview_attempts_user_non_phantom
  on public.interview_attempts (user_id, created_at desc)
  where is_phantom = false;
