-- Depth-signal and psychometric gate scoring columns.
alter table interview_attempts add column if not exists modified_weighted_score_with_psychometrics numeric default null;
alter table interview_attempts add column if not exists psychometric_modifier_applied numeric default null;
alter table interview_attempts add column if not exists final_gate_pass boolean default null;
alter table interview_attempts add column if not exists depth_signal_modifier numeric default null;

alter table users add column if not exists psychometric_modifier numeric default null;
alter table users add column if not exists psychometric_consistency_flags jsonb default null;
alter table users add column if not exists psychometric_straight_line_flags jsonb default null;
