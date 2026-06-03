-- Admin-only annotation: human judgment of pass/fail (does not change routing or gate result).
-- When null, the admin UI follows the user's current effective gate outcome.
alter table public.users
  add column if not exists admin_human_verified_pass boolean default null;

comment on column public.users.admin_human_verified_pass is
  'Admin dashboard: human-verified pass (true) or fail (false). Null = follow current gate display only; does not affect interview_passed.';
