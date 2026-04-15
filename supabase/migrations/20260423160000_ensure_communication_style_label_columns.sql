-- Remotes that created `communication_style_profiles` via 20260403120000 without running
-- 20260402120000_communication_style_labels.sql lack style_labels_* / matchmaker_summary columns.
-- PostgREST returns 400 when the client selects missing columns.

do $$
begin
  if to_regclass('public.communication_style_profiles') is null then
    raise exception
      'public.communication_style_profiles missing. Apply core migrations first (e.g. 20260401110000 or 20260403120000).';
  end if;
end $$;

alter table public.communication_style_profiles
  add column if not exists style_labels_primary text[],
  add column if not exists style_labels_secondary text[],
  add column if not exists matchmaker_summary text,
  add column if not exists low_confidence_note text;
