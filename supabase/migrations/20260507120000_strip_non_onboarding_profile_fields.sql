-- Remove profile JSON keys that are not collected in the dating modal onboarding flow.
-- Canonical dating fields remain in profiles.profile_json via profilesRepo.merge.

update public.profiles
set profile_json =
  coalesce(profile_json, '{}'::jsonb)
  - 'diet'
  - 'sleepSchedule'
  - 'sleep_schedule'
  - 'phoneNumber'
  - 'phone_number'
  - 'contactPreference'
  - 'contact_preference'
  - 'bio'
  - 'cannabis'
  - 'yearlyIncome'
  - 'yearly_income'
  - 'yearlyIncomeCurrency'
  - 'income_currency'
where profile_json ?| array[
  'diet',
  'sleepSchedule',
  'sleep_schedule',
  'phoneNumber',
  'phone_number',
  'contactPreference',
  'contact_preference',
  'bio',
  'cannabis',
  'yearlyIncome',
  'yearly_income',
  'yearlyIncomeCurrency',
  'income_currency'
];

alter table public.profiles drop column if exists diet;
alter table public.profiles drop column if exists sleep_schedule;
alter table public.profiles drop column if exists phone_number;
alter table public.profiles drop column if exists contact_preference;
alter table public.profiles drop column if exists bio;
