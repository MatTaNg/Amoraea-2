-- Open-form scenario prompt sub-threshold re-prompt telemetry (single re-ask + fallthrough audit).
alter table public.interview_attempts
  add column if not exists prompt_word_count_check jsonb default null;

comment on column public.interview_attempts.prompt_word_count_check is
  'Sub-threshold open-form scenario answers: below_threshold_instances with re_prompt_fired / re_prompt_fallthrough audit.';
