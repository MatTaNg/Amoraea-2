-- NPI Entitlement forced-choice instrument (7 pairs, score 0–7)
alter table public.users add column if not exists psychometrics_npi_entitlement_responses jsonb default null;
alter table public.users add column if not exists psychometrics_npi_entitlement_score integer default null;

comment on column public.users.psychometrics_npi_entitlement_responses is
  'NPI Entitlement forced-choice item responses (pair id → { selectedOptionIndex, wasEntitlement }).';
comment on column public.users.psychometrics_npi_entitlement_score is
  'NPI Entitlement count of entitlement poles selected (0–7).';
