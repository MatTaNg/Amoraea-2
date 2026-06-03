-- Copy legacy dating demographics from public.users into profiles.profile_json,
-- then drop redundant columns (users row remains for interview / account).

-- 1. Ensure a profiles row for every users row
insert into public.profiles (id, email, display_name, profile_json, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.name), ''), 'Member'),
  '{}'::jsonb,
  u.created_at,
  timezone('utc', now())
from public.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2. Backfill profile_json (only keys not already present)
-- Note: target alias `p` cannot be referenced inside FROM/LATERAL on UPDATE; compute in SET.
update public.profiles p
set
  profile_json = coalesce(p.profile_json, '{}'::jsonb) || patch.merged,
  updated_at = timezone('utc', now())
from (
  select
    u.id as user_id,
    jsonb_strip_nulls(
    jsonb_build_object(
      'name',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['name', 'displayName', 'display_name'])
          and u.name is not null
          and trim(u.name) <> ''
        then to_jsonb(trim(u.name))
      end,
      'displayName',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['displayName', 'display_name'])
          and coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.name), '')) is not null
        then to_jsonb(coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.name), '')))
      end,
      'display_name',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['display_name', 'displayName'])
          and coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.name), '')) is not null
        then to_jsonb(coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.name), '')))
      end,
      'age',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ? 'age') and u.age is not null
        then to_jsonb(u.age)
      end,
      'gender',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ? 'gender') and u.gender is not null
        then to_jsonb(u.gender)
      end,
      'attractedTo',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['attractedTo', 'lookingFor'])
          and u.attracted_to is not null
          and cardinality(u.attracted_to) > 0
        then to_jsonb(u.attracted_to)
      end,
      'lookingFor',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['lookingFor', 'attractedTo'])
          and u.attracted_to is not null
          and cardinality(u.attracted_to) > 0
        then to_jsonb(u.attracted_to)
      end,
      'height_cm',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['height_cm', 'heightCentimeters'])
          and u.height_centimeters is not null
        then to_jsonb(u.height_centimeters)
      end,
      'heightCentimeters',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['heightCentimeters', 'height_cm'])
          and u.height_centimeters is not null
        then to_jsonb(u.height_centimeters)
      end,
      'occupation',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ? 'occupation')
          and u.occupation is not null
          and trim(u.occupation) <> ''
        then to_jsonb(trim(u.occupation))
      end,
      'location_latitude',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['location_latitude', 'locationLatitude'])
          and u.location_latitude is not null
        then to_jsonb(u.location_latitude)
      end,
      'location_longitude',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['location_longitude', 'locationLongitude'])
          and u.location_longitude is not null
        then to_jsonb(u.location_longitude)
      end,
      'location_label',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['location_label', 'locationLabel'])
          and u.location_label is not null
          and trim(u.location_label) <> ''
        then to_jsonb(trim(u.location_label))
      end,
      'locationLabel',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['locationLabel', 'location_label'])
          and u.location_label is not null
          and trim(u.location_label) <> ''
        then to_jsonb(trim(u.location_label))
      end,
      'location',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ? 'location')
          and u.location_label is not null
          and trim(u.location_label) <> ''
        then to_jsonb(trim(u.location_label))
      end,
      'primaryPhotoUrl',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['primaryPhotoUrl', 'primary_photo_url', 'avatar_url', 'avatarUrl'])
          and u.primary_photo_url is not null
          and trim(u.primary_photo_url) <> ''
        then to_jsonb(trim(u.primary_photo_url))
      end,
      'primary_photo_url',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['primary_photo_url', 'primaryPhotoUrl'])
          and u.primary_photo_url is not null
          and trim(u.primary_photo_url) <> ''
        then to_jsonb(trim(u.primary_photo_url))
      end,
      'avatar_url',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['avatar_url', 'avatarUrl'])
          and u.primary_photo_url is not null
          and trim(u.primary_photo_url) <> ''
        then to_jsonb(trim(u.primary_photo_url))
      end,
      'avatarUrl',
      case
        when not (coalesce(prof.profile_json, '{}'::jsonb) ?| array['avatarUrl', 'avatar_url'])
          and u.primary_photo_url is not null
          and trim(u.primary_photo_url) <> ''
        then to_jsonb(trim(u.primary_photo_url))
      end
    )
    ) as merged
  from public.users u
  join public.profiles prof on prof.id = u.id
) patch
where p.id = patch.user_id
  and patch.merged <> '{}'::jsonb;

-- 3. Mirror primary photo to profiles.avatar_url when column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
  ) then
    update public.profiles p
    set
      avatar_url = trim(u.primary_photo_url),
      updated_at = timezone('utc', now())
    from public.users u
    where p.id = u.id
      and u.primary_photo_url is not null
      and trim(u.primary_photo_url) <> ''
      and (p.avatar_url is null or trim(p.avatar_url) = '');
  end if;
end $$;

-- 4. Drop redundant demographic columns on users (name / display_name kept for interview intro)
alter table public.users
  drop column if exists age,
  drop column if exists gender,
  drop column if exists attracted_to,
  drop column if exists height_centimeters,
  drop column if exists occupation,
  drop column if exists location_latitude,
  drop column if exists location_longitude,
  drop column if exists location_label,
  drop column if exists primary_photo_url;

comment on table public.users is
  'Account + interview routing; dating demographics live in public.profiles.profile_json.';
