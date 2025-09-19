/*
  # Fix admin role policy error

  1. Changes
    - Change "Admins can read all reservations" policy from TO public to TO authenticated
    - This prevents the role "admin" does not exist error by ensuring the policy
      only runs for authenticated users where auth.uid() is available

  2. Security
    - Maintains same access control but fixes the PostgreSQL role interpretation issue
    - Only authenticated users can trigger this policy check
*/

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "Admins can read all reservations" ON reservations;

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