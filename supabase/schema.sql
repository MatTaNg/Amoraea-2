-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Amoraea app data; avoids conflict with profiles from other apps)
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
  primary_photo_url TEXT
);

-- Typologies table
CREATE TABLE IF NOT EXISTS typologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  typology_type TEXT NOT NULL CHECK (typology_type IN ('big_five', 'attachment_style', 'schwartz_values')),
  typology_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(profile_id, typology_type)
);

-- Compatibility table
CREATE TABLE IF NOT EXISTS compatibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  compatibility_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Profile photos table
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_typologies_profile_id ON typologies(profile_id);
CREATE INDEX IF NOT EXISTS idx_typologies_type ON typologies(typology_type);
CREATE INDEX IF NOT EXISTS idx_compatibility_profile_id ON compatibility(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_profile_id ON profile_photos(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_display_order ON profile_photos(profile_id, display_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_typologies_updated_at BEFORE UPDATE ON typologies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compatibility_updated_at BEFORE UPDATE ON compatibility
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE typologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own record"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own record"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Typologies policies
CREATE POLICY "Users can view their own typologies"
  ON typologies FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own typologies"
  ON typologies FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own typologies"
  ON typologies FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own typologies"
  ON typologies FOR DELETE
  USING (auth.uid() = profile_id);

-- Compatibility policies
CREATE POLICY "Users can view their own compatibility"
  ON compatibility FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own compatibility"
  ON compatibility FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own compatibility"
  ON compatibility FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own compatibility"
  ON compatibility FOR DELETE
  USING (auth.uid() = profile_id);

-- Profile photos policies
CREATE POLICY "Users can view their own photos"
  ON profile_photos FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own photos"
  ON profile_photos FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own photos"
  ON profile_photos FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own photos"
  ON profile_photos FOR DELETE
  USING (auth.uid() = profile_id);

