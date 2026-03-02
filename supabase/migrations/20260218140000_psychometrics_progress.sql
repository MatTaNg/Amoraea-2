-- Store partial psychometrics answers (ECR, TIPI, DSI, BRS, PVQ) so user can resume.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS psychometrics_progress JSONB;

COMMENT ON COLUMN users.psychometrics_progress IS 'Partial FullAssessmentData { ecr, tipi, dsi, brs, pvq } for resume during Stage 3';
