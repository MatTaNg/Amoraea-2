-- Historical relational_individual_score was relational-marker share (high = more "we" language).
-- Application + styleTranslations now treat the column as individual-orientation: 0 = relational, 1 = individual.
-- analyze-interview-text now stores (1 − relational share). Flip legacy rows to match.
--
-- After this migration, run (with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
--   npm run reprocess-style-labels
-- (requires Deno). Or redeploy analyze-interview-text and re-invoke it per user to refresh features + labels from transcript.

update public.communication_style_profiles
set relational_individual_score = least(1::double precision, greatest(0::double precision, 1 - relational_individual_score))
where relational_individual_score is not null;

comment on column public.communication_style_profiles.relational_individual_score is
  'Individual-orientation 0–1: 0 = strongly relational (we/partner-focused language), 1 = strongly individual (I/me-first). Text pipeline stores 1 − relational-marker share.';
