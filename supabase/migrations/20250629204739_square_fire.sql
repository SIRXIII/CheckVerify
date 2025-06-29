/*
  # Fix RLS policies for anonymous submissions

  1. Policy Updates
    - Update anonymous insert policy for reservations to explicitly handle NULL traveler_id
    - Ensure verification_documents and digital_signatures allow anonymous inserts
    - Maintain admin access policies

  2. Security
    - Anonymous users can only insert with NULL traveler_id
    - Admins maintain full read/update access
    - Authenticated users can read their own reservations
*/

-- Drop all existing policies on reservations table to start fresh
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Travelers can read own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON reservations;
DROP POLICY IF EXISTS "Travelers can insert own reservations" ON reservations;
DROP POLICY IF EXISTS "Allow anonymous insert reservations" ON reservations;
DROP POLICY IF EXISTS "Allow authenticated insert reservations" ON reservations;

-- Create policy to allow anonymous users to insert reservations with NULL traveler_id
CREATE POLICY "Allow anonymous insert reservations"
  ON reservations
  FOR INSERT
  TO anon
  WITH CHECK (traveler_id IS NULL);

-- Create policy to allow authenticated users to insert reservations
CREATE POLICY "Allow authenticated insert reservations"
  ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy for travelers to read their own reservations
CREATE POLICY "Travelers can read own reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (traveler_id = auth.uid());

-- Create policy for admins to read all reservations
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

-- Create policy for admins to update all reservations
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

-- Ensure verification_documents policies allow anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert verification documents" ON verification_documents;

CREATE POLICY "Anyone can insert verification documents"
  ON verification_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Ensure digital_signatures policies allow anonymous inserts
DROP POLICY IF EXISTS "Anyone can insert digital signatures" ON digital_signatures;

CREATE POLICY "Anyone can insert digital signatures"
  ON digital_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);