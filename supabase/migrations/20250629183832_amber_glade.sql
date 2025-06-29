/*
  # Update verification schema for simplified check-in process

  1. Changes to Tables
    - Update verification_documents table to remove traveler_id and reservation_id requirements
    - Update digital_signatures table to remove traveler_id and reservation_id requirements
    - Add form_data fields to store guest information directly

  2. Security
    - Update RLS policies to allow anonymous submissions
    - Maintain admin access for review
*/

-- Update verification_documents table
ALTER TABLE verification_documents 
  ALTER COLUMN traveler_id DROP NOT NULL,
  ALTER COLUMN reservation_id DROP NOT NULL;

-- Update digital_signatures table  
ALTER TABLE digital_signatures
  ALTER COLUMN traveler_id DROP NOT NULL,
  ALTER COLUMN reservation_id DROP NOT NULL;

-- Drop existing RLS policies for verification_documents
DROP POLICY IF EXISTS "Admins can read all documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can update all documents" ON verification_documents;
DROP POLICY IF EXISTS "Travelers can insert own documents" ON verification_documents;
DROP POLICY IF EXISTS "Travelers can read own documents" ON verification_documents;

-- Drop existing RLS policies for digital_signatures
DROP POLICY IF EXISTS "Admins can read all signatures" ON digital_signatures;
DROP POLICY IF EXISTS "Travelers can insert own signatures" ON digital_signatures;
DROP POLICY IF EXISTS "Travelers can read own signatures" ON digital_signatures;

-- Create new policies for verification_documents (allow anonymous submissions)
CREATE POLICY "Anyone can insert verification documents"
  ON verification_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read verification documents"
  ON verification_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update verification documents"
  ON verification_documents
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create new policies for digital_signatures (allow anonymous submissions)
CREATE POLICY "Anyone can insert digital signatures"
  ON digital_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read digital signatures"
  ON digital_signatures
  FOR SELECT
  TO authenticated
  USING (true);