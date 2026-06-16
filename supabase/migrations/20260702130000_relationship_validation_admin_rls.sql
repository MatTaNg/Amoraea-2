-- Admin read access for relationship validation cohort analytics.

CREATE POLICY relationship_validation_records_select_admin
  ON public.relationship_validation_records
  FOR SELECT
  TO authenticated
  USING (public.is_amoraea_admin());
