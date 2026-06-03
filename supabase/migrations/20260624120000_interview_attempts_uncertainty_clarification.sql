-- Adaptive uncertainty scoring and clarification battery routing

alter table public.interview_attempts add column if not exists uncertainty_score numeric default null;
alter table public.interview_attempts add column if not exists uncertainty_breakdown jsonb default null;
alter table public.interview_attempts add column if not exists requires_clarification_battery boolean default false;
alter table public.interview_attempts add column if not exists clarification_battery_completed_at timestamptz default null;
alter table public.interview_attempts add column if not exists post_clarification_uncertainty_score numeric default null;
alter table public.interview_attempts add column if not exists uncertainty_pending_admin_review boolean default false;

alter table public.interview_attempts add column if not exists clarification_current_assessment text default null;
alter table public.interview_attempts add column if not exists clarification_current_question_index integer default null;
alter table public.interview_attempts add column if not exists clarification_partial_responses jsonb default null;

alter table public.interview_attempts add column if not exists clarification_narq_s_rivalry_responses jsonb default null;
alter table public.interview_attempts add column if not exists clarification_narq_s_rivalry_score numeric default null;
alter table public.interview_attempts add column if not exists clarification_rfq_responses jsonb default null;
alter table public.interview_attempts add column if not exists clarification_rfq_score numeric default null;
alter table public.interview_attempts add column if not exists clarification_iri_personal_distress_responses jsonb default null;
alter table public.interview_attempts add column if not exists clarification_iri_personal_distress_score numeric default null;
alter table public.interview_attempts add column if not exists clarification_rbi_dysfunctional_responses jsonb default null;
alter table public.interview_attempts add column if not exists clarification_rbi_dysfunctional_score numeric default null;
