-- Alpha tester flag: set at signup when valid referral code is used; not user-editable via normal updates.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_alpha_tester BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN users.is_alpha_tester IS 'True when account was created with the alpha tester referral code; immutable for self-service updates.';

CREATE OR REPLACE FUNCTION users_preserve_is_alpha_tester()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_alpha_tester IS DISTINCT FROM OLD.is_alpha_tester THEN
    NEW.is_alpha_tester := OLD.is_alpha_tester;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_preserve_is_alpha_tester ON users;
CREATE TRIGGER trg_users_preserve_is_alpha_tester
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION users_preserve_is_alpha_tester();
