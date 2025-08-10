/*
  # Fix RLS policies for anonymous submissions

  1. Changes
    - Allow anonymous users to insert reservations without restrictions
    - Allow anonymous users to insert verification documents
    - Allow anonymous users to insert digital signatures
    - Maintain admin access for reading and updating

  2. Security
    - Enable anonymous submissions for the public form
    - Preserve admin-only access to sensitive operations
    - Allow public role access where needed
*/

-- Drop existing problematic policies on reservations
DROP POLICY IF EXISTS "Allow anonymous insert reservations" ON reservations;
DROP POLICY IF EXISTS "Allow authenticated insert reservations" ON reservations;
DROP POLICY IF EXISTS "Travelers can read own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON reservations;

-- Create new policies for reservations
CREATE POLICY "Allow anonymous insert reservations"
  ON reservations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated insert reservations"
  ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Travelers can read own reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (traveler_id = auth.uid());

CREATE POLICY "Admins can read all reservations"
  ON reservations
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update all reservations"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );

-- Development policy moved to supabase/dev/dev-open-insert.sql for local testing
-- CREATE POLICY "dev-open-insert"
--   ON reservations
--   FOR INSERT
--   TO public
--   WITH CHECK (true);

-- Ensure verification_documents allows anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can read all verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can update verification documents" ON verification_documents;

CREATE POLICY "Anyone can insert verification documents"
  ON verification_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all verification documents"
  ON verification_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update verification documents"
  ON verification_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );

-- Ensure digital_signatures allows anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert digital signatures" ON digital_signatures;
DROP POLICY IF EXISTS "Admins can read all digital signatures" ON digital_signatures;

CREATE POLICY "Anyone can insert digital signatures"
  ON digital_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all digital signatures"
  ON digital_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );