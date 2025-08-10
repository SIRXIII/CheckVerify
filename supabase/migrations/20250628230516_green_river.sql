/*
  # Initial Schema for Hotel Verification System

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `user_type` (text) - 'traveler' or 'admin'
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `reservations`
      - `id` (uuid, primary key)
      - `traveler_id` (uuid, references user_profiles)
      - `confirmation_number` (text, unique)
      - `guest_name` (text)
      - `check_in_date` (date)
      - `check_out_date` (date)
      - `total_amount` (decimal)
      - `booking_platform` (text)
      - `room_type` (text)
      - `special_requests` (text)
      - `status` (text) - 'pending', 'verified', 'rejected'
      - `documents_uploaded` (boolean)
      - `signature_completed` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `verification_documents`
      - `id` (uuid, primary key)
      - `traveler_id` (uuid, references user_profiles)
      - `reservation_id` (uuid, references reservations)
      - `id_document_path` (text)
      - `id_document_name` (text)
      - `credit_card_path` (text)
      - `credit_card_name` (text)
      - `status` (text) - 'pending', 'verified', 'rejected'
      - `reviewed_by` (uuid, references user_profiles)
      - `reviewed_at` (timestamp)
      - `created_at` (timestamp)
    
    - `digital_signatures`
      - `id` (uuid, primary key)
      - `traveler_id` (uuid, references user_profiles)
      - `reservation_id` (uuid, references reservations)
      - `signature_data` (text)
      - `form_data` (jsonb)
      - `signed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for admin users to access all data
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('traveler', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  confirmation_number text UNIQUE NOT NULL,
  guest_name text NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  booking_platform text NOT NULL,
  room_type text DEFAULT '',
  special_requests text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  documents_uploaded boolean DEFAULT false,
  signature_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create verification_documents table
CREATE TABLE IF NOT EXISTS verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  id_document_path text DEFAULT '',
  id_document_name text DEFAULT '',
  credit_card_path text DEFAULT '',
  credit_card_name text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create digital_signatures table
CREATE TABLE IF NOT EXISTS digital_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  signature_data text NOT NULL,
  form_data jsonb DEFAULT '{}',
  signed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Create policies for reservations
CREATE POLICY "Travelers can read own reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (traveler_id = auth.uid());

CREATE POLICY "Travelers can insert own reservations"
  ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (traveler_id = auth.uid());

CREATE POLICY "Admins can read all reservations"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update all reservations"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Create policies for verification_documents
CREATE POLICY "Travelers can read own documents"
  ON verification_documents
  FOR SELECT
  TO authenticated
  USING (traveler_id = auth.uid());

CREATE POLICY "Travelers can insert own documents"
  ON verification_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (traveler_id = auth.uid());

CREATE POLICY "Admins can read all documents"
  ON verification_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update all documents"
  ON verification_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Create policies for digital_signatures
CREATE POLICY "Travelers can read own signatures"
  ON digital_signatures
  FOR SELECT
  TO authenticated
  USING (traveler_id = auth.uid());

CREATE POLICY "Travelers can insert own signatures"
  ON digital_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (traveler_id = auth.uid());

CREATE POLICY "Admins can read all signatures"
  ON digital_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_traveler_id ON reservations(traveler_id);
CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_number ON reservations(confirmation_number);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_verification_documents_traveler_id ON verification_documents(traveler_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON verification_documents(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_traveler_id ON digital_signatures(traveler_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();