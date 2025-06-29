/*
  # Fix RLS Policy for Reservations Table

  1. Changes
    - Drop all existing policies on reservations table
    - Create new simplified policies that allow anonymous submissions
    - Ensure admin users can still read and update all reservations
    - Allow travelers to read their own reservations

  2. Security
    - Enable RLS on reservations table (already enabled)
    - Allow anonymous users to insert reservations (for public form)
    - Allow authenticated users to read their own reservations
    - Allow admin users to read and update all reservations
*/

-- Drop all existing policies on reservations table to start fresh
DROP POLICY IF EXISTS "Anyone can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Travelers can read own reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can read all reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON reservations;
DROP POLICY IF EXISTS "Travelers can insert own reservations" ON reservations;

-- Create policy to allow anonymous users to insert reservations
CREATE POLICY "Allow anonymous insert reservations"
  ON reservations
  FOR INSERT
  TO anon
  WITH CHECK (true);

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