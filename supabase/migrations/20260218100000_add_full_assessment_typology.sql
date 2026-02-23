-- Allow full_assessment typology type (stores ECR-12, TIPI, DSI, BRS, PVQ-21 in one blob)
ALTER TABLE typologies DROP CONSTRAINT IF EXISTS typologies_typology_type_check;
ALTER TABLE typologies ADD CONSTRAINT typologies_typology_type_check
  CHECK (typology_type IN ('big_five', 'attachment_style', 'schwartz_values', 'full_assessment'));
