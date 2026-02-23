-- Add invite code and referral tracking to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_id);

-- RPC to look up user id by invite code (for referral at signup). Runs with elevated privileges.
CREATE OR REPLACE FUNCTION get_user_id_by_invite_code(code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM users WHERE invite_code = UPPER(TRIM(code)) AND invite_code IS NOT NULL LIMIT 1;
  RETURN user_id;
END;
$$;

-- Generate invite_code on INSERT when null (covers users created via other paths)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  exists BOOLEAN;
BEGIN
  IF NEW.invite_code IS NOT NULL AND NEW.invite_code != '' THEN
    RETURN NEW;
  END IF;
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  LOOP
    SELECT EXISTS(SELECT 1 FROM users WHERE invite_code = result) INTO exists;
    EXIT WHEN NOT exists;
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
  END LOOP;
  NEW.invite_code := result;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_generate_invite_code ON users;
CREATE TRIGGER trigger_generate_invite_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- Backfill invite_code for existing users
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM users WHERE invite_code IS NULL OR invite_code = ''
  LOOP
    new_code := '';
    FOR i IN 1..6 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    LOOP
      SELECT EXISTS(SELECT 1 FROM users WHERE invite_code = new_code) INTO exists;
      EXIT WHEN NOT exists;
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
    END LOOP;
    UPDATE users SET invite_code = new_code WHERE id = r.id;
  END LOOP;
END;
$$;
