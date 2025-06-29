/*
  # Development RLS Fix (REMOVE BEFORE PRODUCTION!)
  
  This migration temporarily disables RLS restrictions for development purposes.
  
  ## Changes
  1. Enable RLS on reservations table
  2. Create open insert policy for development
  
  ## IMPORTANT
  - This is for development only
  - Remove this migration before production deployment
  - Replace with proper security policies for production
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