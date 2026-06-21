ALTER TABLE members ADD COLUMN IF NOT EXISTS member_code TEXT UNIQUE;

-- Create an index for ordering
CREATE INDEX IF NOT EXISTS idx_members_registered_at_id ON members (registered_at, id);
