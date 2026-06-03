-- Remove redundant sexual feedback / needs-communication profile questions.
-- Sexual communication comfort is captured by the post-interview SEXUAL_COMMUNICATION psychometric.

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb)
  - 'sexualFeedbackStyle'
  - 'sexual_feedback_style'
  - 'sexualNeedsCommunicationComfort'
  - 'sexual_needs_communication_comfort'
where profile_json ? 'sexualFeedbackStyle'
   or profile_json ? 'sexual_feedback_style'
   or profile_json ? 'sexualNeedsCommunicationComfort'
   or profile_json ? 'sexual_needs_communication_comfort';

alter table public.profiles drop column if exists sexual_feedback_style;
alter table public.profiles drop column if exists "sexualFeedbackStyle";
alter table public.profiles drop column if exists sexual_needs_communication_comfort;
alter table public.profiles drop column if exists "sexualNeedsCommunicationComfort";

do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'datingPaceAfterExcitement'
    where current_step in ('sexualFeedback', 'sexualNeedsCommunication');

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb)
      - 'sexualFeedbackStyle'
      - 'sexualNeedsCommunicationComfort'
    where onboarding_data ? 'sexualFeedbackStyle'
       or onboarding_data ? 'sexualNeedsCommunicationComfort';
  end if;
end $$;
