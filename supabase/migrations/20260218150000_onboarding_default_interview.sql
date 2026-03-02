-- New users start at interview stage instead of basic_info.
ALTER TABLE users ALTER COLUMN onboarding_stage SET DEFAULT 'interview';
