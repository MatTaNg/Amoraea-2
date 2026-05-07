alter table public.users
  drop column if exists yearly_income,
  drop column if exists income_currency;
