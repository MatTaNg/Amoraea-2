-- Amoraea: Create users table (avoids conflict with profiles from other apps).
-- Run this in Supabase SQL Editor.
-- If typologies/compatibility/profile_photos exist and reference profiles, drop them first:
--   DROP TABLE IF EXISTS profile_photos, compatibility, typologies CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
  onboarding_step INTEGER DEFAULT 1 NOT NULL,
  name TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Man', 'Woman', 'Non-binary', 'man', 'woman', 'non-binary', 'non_binary')),
  attracted_to TEXT[],
  height_centimeters INTEGER,
  occupation TEXT,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  location_label TEXT,
  primary_photo_url TEXT,
  email TEXT,
  display_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own record"
  ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own record"
  ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create typologies table (references users)
CREATE TABLE IF NOT EXISTS typologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  typology_type TEXT NOT NULL CHECK (typology_type IN ('big_five', 'attachment_style', 'schwartz_values')),
  typology_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(profile_id, typology_type)
);

CREATE INDEX IF NOT EXISTS idx_typologies_profile_id ON typologies(profile_id);
CREATE INDEX IF NOT EXISTS idx_typologies_type ON typologies(typology_type);

CREATE TRIGGER update_typologies_updated_at BEFORE UPDATE ON typologies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE typologies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own typologies" ON typologies FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own typologies" ON typologies FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own typologies" ON typologies FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete own typologies" ON typologies FOR DELETE USING (auth.uid() = profile_id);

-- Create compatibility table (references users)
CREATE TABLE IF NOT EXISTS compatibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  compatibility_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compatibility_profile_id ON compatibility(profile_id);

CREATE TRIGGER update_compatibility_updated_at BEFORE UPDATE ON compatibility
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE compatibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own compatibility" ON compatibility FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own compatibility" ON compatibility FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own compatibility" ON compatibility FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete own compatibility" ON compatibility FOR DELETE USING (auth.uid() = profile_id);

-- Create profile_photos table (references users)
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_profile_id ON profile_photos(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_display_order ON profile_photos(profile_id, display_order);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own photos" ON profile_photos FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own photos" ON profile_photos FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own photos" ON profile_photos FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete own photos" ON profile_photos FOR DELETE USING (auth.uid() = profile_id);
