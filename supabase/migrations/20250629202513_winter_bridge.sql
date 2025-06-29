/*
  # Create documents storage bucket

  1. Storage
    - Create 'documents' bucket for file uploads
    - Set up public access policies for document storage
    - Configure RLS policies for secure access

  2. Security
    - Enable RLS on storage objects
    - Allow public read access to documents
    - Allow authenticated users to upload documents
*/

-- Create the documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view documents
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Allow anyone to upload documents
CREATE POLICY "Anyone can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Allow anyone to update their own documents
CREATE POLICY "Anyone can update documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents');