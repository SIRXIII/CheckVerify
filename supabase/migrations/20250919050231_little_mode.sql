/*
  # Fix Admin User Type Constraint

  1. Database Schema Fix
    - Drop and recreate the user_type check constraint to ensure 'admin' is properly recognized
    - Update any existing RLS policies that might be causing role conflicts
    - Ensure the user_type column accepts both 'traveler' and 'admin' values

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control for admin users
*/

-- Drop the existing check constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

-- Recreate the check constraint with explicit values
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_type_check 
  CHECK (user_type IN ('traveler', 'admin'));

-- Ensure the column is properly typed as text
ALTER TABLE user_profiles ALTER COLUMN user_type TYPE text;

-- Update any problematic RLS policies that reference roles incorrectly
DROP POLICY IF EXISTS "Admin Update Role Type" ON user_profiles;

-- Create a proper admin update policy
CREATE POLICY "Admin Update Role Type" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() 
      AND up.user_type = 'admin'
    )
  );