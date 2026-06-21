-- =============================================
-- THE FAMILY SYNC — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- =============================================

-- 1. Family Groups
CREATE TABLE IF NOT EXISTS family_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Members
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  citizenship TEXT,
  relationship_status TEXT CHECK (relationship_status IN ('single', 'married', 'widowed', 'separated', 'divorced')),
  wedding_anniversary DATE,
  communicant_class_graduate TEXT CHECK (communicant_class_graduate IN ('Yes', 'No')),
  date_of_membership DATE,
  membership_status TEXT DEFAULT 'new' CHECK (membership_status IN ('new', 'active', 'dormant', 'cancelled')),
  membership_type TEXT CHECK (membership_type IN ('regular', 'associate', 'affiliate')),
  phone_number TEXT,
  email_address TEXT,
  street_address TEXT,
  village TEXT,
  barangay TEXT,
  city TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  profile_picture TEXT,
  member_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Relationships (supports cross-family linking)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  related_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('spouse', 'father', 'mother', 'sibling', 'child', 'grandchild')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, related_member_id, relationship_type)
);

-- =============================================
-- AUTO-UPDATE TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_updated_at ON members;
CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all records
CREATE POLICY "Authenticated full access on family_groups"
  ON family_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated full access on members"
  ON members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated full access on relationships"
  ON relationships FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- SAMPLE DATA (optional — remove in production)
-- =============================================
-- INSERT INTO family_groups (name, description)
-- VALUES ('Santos Family', 'Primary family group');
