-- Experiential labels derived from communication_style_profiles (see styleTranslations.ts).
--
-- Prerequisite: run 20260401110000_add_communication_style_profiles.sql first (creates this table),
-- or use `supabase db push` / `supabase migration up` so migrations apply in timestamp order.

do $$
begin
  if to_regclass('public.communication_style_profiles') is null then
    raise exception
      'Table communication_style_profiles does not exist. Run the migration '
      '20260401110000_add_communication_style_profiles.sql first (creates the table and style_processing_log), '
      'then run this file again.';
  end if;
end $$;

alter table communication_style_profiles
  add column if not exists style_labels_primary text[],
  add column if not exists style_labels_secondary text[],
  add column if not exists matchmaker_summary text,
  add column if not exists low_confidence_note text; 