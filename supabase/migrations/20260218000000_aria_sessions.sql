-- Aria voice matchmaker: store one session per completion (answers to the 6 pillars).
CREATE TABLE IF NOT EXISTS aria_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aria_sessions_profile_id ON aria_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_aria_sessions_created_at ON aria_sessions(profile_id, created_at DESC);

CREATE TRIGGER update_aria_sessions_updated_at BEFORE UPDATE ON aria_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE aria_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aria_sessions"
  ON aria_sessions FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own aria_sessions"
  ON aria_sessions FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own aria_sessions"
  ON aria_sessions FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete own aria_sessions"
  ON aria_sessions FOR DELETE USING (auth.uid() = profile_id);
