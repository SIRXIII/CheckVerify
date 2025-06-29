/*
  # Development RLS Fix for Reservations Table
  
  This migration creates a temporary development policy to allow unrestricted
  inserts to the reservations table, resolving RLS policy violations during
  form submissions.
  
  ⚠️  WARNING: This is for DEVELOPMENT ONLY
  ⚠️  Remove this policy before production deployment
  
  1. Changes Made
     - Enable RLS on reservations table
     - Create open insert policy for development
  
  2. Security Notes
     - This policy bypasses normal security controls
     - Should be replaced with proper validation in production
     - Consider using Edge Functions with service role for production
*/

-- Ensure RLS is enabled on reservations table
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing development policy if it exists
DROP POLICY IF EXISTS "dev-open-insert" ON public.reservations;

-- Create development policy that allows all inserts
CREATE POLICY "dev-open-insert"
  ON public.reservations
  FOR INSERT
  USING (true)          -- who may INSERT (everyone)
  WITH CHECK (true);    -- what rows they may insert (any)