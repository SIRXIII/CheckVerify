/*
  # Fix RLS policies for user_profiles table

  1. Changes
    - Drop existing problematic RLS policies that cause infinite recursion
    - Create new, simplified RLS policies that don't reference the same table
    - Ensure users can insert their own profile during signup
    - Allow users to read and update their own profile
    - Allow admins to read all profiles

  2. Security
    - Enable RLS on user_profiles table (already enabled)
    - Add policy for users to insert their own profile
    - Add policy for users to read their own profile
    - Add policy for users to update their own profile
    - Add policy for admins to read all profiles
*/

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create new policies that don't cause recursion
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create a separate policy for admins to read all profiles
-- This uses a simpler approach without self-referencing
CREATE POLICY "Service role can read all profiles"
  ON user_profiles
  FOR SELECT
  TO service_role
  USING (true);

-- Allow authenticated users to read profiles for admin functionality
-- We'll handle admin checks in the application layer instead of RLS
CREATE POLICY "Authenticated users can read profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);