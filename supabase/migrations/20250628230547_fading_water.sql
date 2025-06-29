/*
  # Seed Sample Data for Hotel Verification System

  1. Sample Data
    - Create sample admin user profile
    - Create sample reservations
    - Create sample verification documents
    - Create sample digital signatures

  2. Notes
    - This is for development/demo purposes only
    - In production, real user data would be created through the application
*/

-- Insert sample user profiles (requires existing auth.users)
-- Note: In a real application, these would be created when users sign up

-- Sample reservations for demo purposes
INSERT INTO reservations (
  id,
  traveler_id,
  confirmation_number,
  guest_name,
  check_in_date,
  check_out_date,
  total_amount,
  booking_platform,
  room_type,
  special_requests,
  status,
  documents_uploaded,
  signature_completed
) VALUES
  (
    gen_random_uuid(),
    gen_random_uuid(), -- This would be a real user ID in production
    'BK123456789',
    'John Doe',
    '2025-02-15',
    '2025-02-20',
    850.00,
    'Booking.com',
    'Deluxe Ocean View',
    'Late check-in requested',
    'pending',
    true,
    false
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(), -- This would be a real user ID in production
    'EX987654321',
    'Jane Smith',
    '2025-03-01',
    '2025-03-05',
    1200.00,
    'Expedia',
    'Presidential Suite',
    '',
    'verified',
    true,
    true
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(), -- This would be a real user ID in production
    'HT456789123',
    'Michael Johnson',
    '2025-02-28',
    '2025-03-03',
    675.00,
    'Hotels.com',
    'Standard Room',
    '',
    'pending',
    false,
    false
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(), -- This would be a real user ID in production
    'AB789123456',
    'Sarah Wilson',
    '2025-03-10',
    '2025-03-15',
    950.00,
    'Airbnb',
    'Luxury Apartment',
    'Pet-friendly accommodation',
    'rejected',
    true,
    false
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(), -- This would be a real user ID in production
    'BK555666777',
    'David Brown',
    '2025-04-01',
    '2025-04-07',
    1800.00,
    'Booking.com',
    'Penthouse Suite',
    'Anniversary celebration',
    'verified',
    true,
    true
  );

-- Note: In a real application, you would need to:
-- 1. Create actual users through Supabase Auth
-- 2. Use their real UUIDs for traveler_id references
-- 3. Upload real documents to Supabase Storage
-- 4. Create proper verification_documents and digital_signatures records

-- For demo purposes, we're just showing the structure
-- The actual data would be populated when users interact with the application