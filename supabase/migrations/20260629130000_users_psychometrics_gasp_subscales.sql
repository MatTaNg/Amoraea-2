-- GASP Guilt–Repair and Shame–Withdraw subscale scores (Cohen et al. 2011).
-- psychometrics_gasp_score remains the externalization mean for backward compatibility.

alter table public.users add column if not exists psychometrics_gasp_guilt_repair_score numeric default null;
alter table public.users add column if not exists psychometrics_gasp_shame_withdraw_score numeric default null;
