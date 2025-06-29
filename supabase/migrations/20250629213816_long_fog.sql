/*
  # Fix anonymous reservation insertion

  1. Security Updates
    - Update RLS policies for reservations table to allow anonymous users to create reservations
    - Ensure anonymous users can only create reservations with traveler_id as NULL
    - Remove conflicting policies that might block anonymous insertion

  2. Changes
    - Drop existing conflicting policies
    - Create new policy specifically for anonymous reservation creation
    - Ensure the policy allows INSERT operations for anon role
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow anonymous insert reservations" ON reservations;
DROP POLICY IF EXISTS "dev-open-insert" ON reservations;

-- Create a clear policy for anonymous reservation creation
CREATE POLICY "Anonymous users can create reservations"
  ON reservations
  FOR INSERT
  TO anon
  WITH CHECK (traveler_id IS NULL);

-- Create a policy for authenticated users to create reservations
CREATE POLICY "Authenticated users can create reservations"
  ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);