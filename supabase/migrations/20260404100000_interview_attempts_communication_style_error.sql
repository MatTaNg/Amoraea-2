-- Surface communication-style pipeline failures on the attempt row (admin / debugging).

alter table interview_attempts
  add column if not exists communication_style_error text;

comment on column interview_attempts.communication_style_error is
  'Set when analyze-interview-text or analyze-interview-audio finalize fails after save; null when pipeline succeeded or was not run.';
