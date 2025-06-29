/*
  # Fix RLS policies for public verification form

  1. Policy Updates
    - Allow anonymous users to insert reservations
    - Allow anonymous users to insert verification documents
    - Allow anonymous users to insert digital signatures
    - Maintain admin access for reading and updating

  2. Security
    - Keep RLS enabled on all tables
    - Ensure proper access controls for different user types
    - Allow public submissions while protecting admin operations
*/

-- Update reservations table policies
DROP POLICY IF EXISTS "Travelers can insert own reservations" ON reservations;

CREATE POLICY "Anyone can insert reservations"
  ON reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Update verification_documents table policies  
DROP POLICY IF EXISTS "Anyone can insert verification documents" ON verification_documents;

CREATE POLICY "Anyone can insert verification documents"
  ON verification_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Update digital_signatures table policies
DROP POLICY IF EXISTS "Anyone can insert digital signatures" ON digital_signatures;

CREATE POLICY "Anyone can insert digital signatures"
  ON digital_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Ensure admin users can read all data
CREATE POLICY "Admins can read all reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.user_type = 'admin'
    )
  );

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