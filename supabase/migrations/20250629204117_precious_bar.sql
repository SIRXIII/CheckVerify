/*
  # Fix RLS Policies for Anonymous Access

  1. Policy Updates
    - Allow anonymous users to insert into reservations, verification_documents, and digital_signatures
    - Ensure admin users can read all data for dashboard functionality
    - Remove conflicting policies and recreate them properly

  2. Security
    - Maintain RLS protection while allowing public form submissions
    - Preserve admin-only access to sensitive operations
*/

-- Update reservations table policies
DROP POLICY IF EXISTS "Travelers can insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;

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

-- Handle existing admin policies by dropping and recreating
DROP POLICY IF EXISTS "Admins can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON reservations;

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

-- Handle verification_documents admin policies
DROP POLICY IF EXISTS "Admins can read all verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Authenticated users can read verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Authenticated users can update verification documents" ON verification_documents;

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

-- Handle digital_signatures admin policies
DROP POLICY IF EXISTS "Admins can read all digital signatures" ON digital_signatures;
DROP POLICY IF EXISTS "Authenticated users can read digital signatures" ON digital_signatures;

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