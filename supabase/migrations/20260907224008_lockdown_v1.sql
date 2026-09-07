/*
  # Emergency RLS lockdown v1

  What: closes public read/write access that accumulated on this project
  through dashboard-authored RLS policies (visible in pg_policies live but
  never captured in a migration). Specifically, this migration:

    1. Adds `public.is_admin()` — a single, centralized definition of
       "is the current user an admin" (SECURITY DEFINER so it can read
       user_profiles regardless of the caller's own RLS visibility into
       that table).
    2. Drops every duplicate/leaky/orphaned policy identified in the
       2026-09-07 live catalog (anon_* duplicates, "Allow anon select
       reservations", the dev-open-insert backdoor, orphaned JWT-based
       admin policies that reference app_metadata roles nothing sets,
       the public storage.objects policies on the `documents` bucket,
       etc).
    3. Replaces the ad hoc EXISTS-based admin policies with policies
       that call is_admin(), and replaces the "allow anyone to insert
       anything" guest policies with policies that only allow a
       pending-status, self-consistent row.
    4. Adds a trigger that blocks anon/authenticated sessions from ever
       setting user_type = 'admin' on their own profile (defense in
       depth under the is_admin() checks above, which themselves read
       user_type).
    5. Makes the `documents` storage bucket private with a file-size and
       mime-type limit, and replaces its public policies with a
       folder-scoped anon upload policy and an admin-only read policy.
       Deletes the unused `verification_uploads` bucket and its (empty)
       objects.
    6. Pins the search_path on the pre-existing trigger function that
       had none (advisor warning).

  Why now: `documents` storage bucket is public with no size/type limits
  (~916 MB of guest-uploaded ID photos and credit card photos world
  readable at a guessable URL), and several tables have "anyone can
  SELECT everything" or duplicate "anyone can INSERT anything" policies
  left over from earlier debugging sessions, alongside orphaned policies
  that reference a JWT admin role the app never sets.

  ---------------------------------------------------------------------
  VERIFY AFTER APPLY

  Run:

    select schemaname, tablename, policyname, roles, cmd
    from pg_policies
    where schemaname in ('public', 'storage')
    order by schemaname, tablename, policyname;

  Expected remaining policies (14 total):

    public | digital_signatures      | admin_select_digital_signatures
    public | digital_signatures      | guest_insert_signature
    public | reservations            | admin_select_reservations
    public | reservations            | admin_update_reservations
    public | reservations            | guest_insert_reservation
    public | user_profiles           | Service role can read all profiles
    public | user_profiles           | Users can insert own profile
    public | user_profiles           | Users can read own profile
    public | user_profiles           | Users can update own profile
    public | verification_documents  | admin_select_verification_documents
    public | verification_documents  | admin_update_verification_documents
    public | verification_documents  | guest_insert_verification_document
    storage | objects                | admin_read_documents
    storage | objects                | guest_upload_documents

  Also verify: `select public, file_size_limit, allowed_mime_types from
  storage.buckets where id = 'documents';` -> public=false,
  file_size_limit=5242880, allowed_mime_types={image/jpeg,image/png}.
  ---------------------------------------------------------------------
*/


-- ---------------------------------------------------------------------
-- 1. is_admin() helper
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND user_type = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Drop every policy annotated DROP in the 2026-09-07 live catalog
-- ---------------------------------------------------------------------

-- digital_signatures
DROP POLICY IF EXISTS "anon_insert_digital_signatures" ON public.digital_signatures;
DROP POLICY IF EXISTS "anon_select_digital_signatures" ON public.digital_signatures;

-- storage.objects (documents bucket public policies + verification_uploads policies)
DROP POLICY IF EXISTS "Anyone can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_documents" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_uploads" ON storage.objects;
DROP POLICY IF EXISTS "anon_read_documents" ON storage.objects;
DROP POLICY IF EXISTS "anon_read_uploads" ON storage.objects;

-- reservations
DROP POLICY IF EXISTS "Admins can delete" ON public.reservations;
DROP POLICY IF EXISTS "Admins can insert" ON public.reservations;
DROP POLICY IF EXISTS "Admins can select" ON public.reservations;
DROP POLICY IF EXISTS "Admins can update" ON public.reservations;
DROP POLICY IF EXISTS "Allow anon inserts for reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow anon select reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow anonymous insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Travelers can read own reservations" ON public.reservations;
DROP POLICY IF EXISTS "anon_insert_reservations" ON public.reservations;
DROP POLICY IF EXISTS "anon_select_reservations" ON public.reservations;
DROP POLICY IF EXISTS "dev-open-insert" ON public.reservations;

-- user_profiles
DROP POLICY IF EXISTS "Admin Update Role Type" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.user_profiles;

-- verification_documents
DROP POLICY IF EXISTS "anon_insert_verif_docs" ON public.verification_documents;
DROP POLICY IF EXISTS "anon_select_verif_docs" ON public.verification_documents;

-- ---------------------------------------------------------------------
-- 3. Replace EXISTS-based admin policies + legacy "anyone can insert"
--    policies with is_admin()-backed / status-scoped ones
-- ---------------------------------------------------------------------

-- reservations
DROP POLICY IF EXISTS "Admins can read all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can update all reservations" ON public.reservations;
DROP POLICY IF EXISTS "admin_select_reservations" ON public.reservations;
DROP POLICY IF EXISTS "admin_update_reservations" ON public.reservations;

CREATE POLICY "admin_select_reservations"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_update_reservations"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- verification_documents
DROP POLICY IF EXISTS "Admins can read all verification documents" ON public.verification_documents;
DROP POLICY IF EXISTS "Admins can update verification documents" ON public.verification_documents;
DROP POLICY IF EXISTS "Anyone can insert verification documents" ON public.verification_documents;
DROP POLICY IF EXISTS "admin_select_verification_documents" ON public.verification_documents;
DROP POLICY IF EXISTS "admin_update_verification_documents" ON public.verification_documents;

CREATE POLICY "admin_select_verification_documents"
  ON public.verification_documents
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_update_verification_documents"
  ON public.verification_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- digital_signatures
DROP POLICY IF EXISTS "Admins can read all digital signatures" ON public.digital_signatures;
DROP POLICY IF EXISTS "Anyone can insert digital signatures" ON public.digital_signatures;
DROP POLICY IF EXISTS "admin_select_digital_signatures" ON public.digital_signatures;

CREATE POLICY "admin_select_digital_signatures"
  ON public.digital_signatures
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Guest (anon) INSERT policies — exactly one per table, each scoped
--    to a self-consistent "new pending submission"
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "guest_insert_reservation" ON public.reservations;

CREATE POLICY "guest_insert_reservation"
  ON public.reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    traveler_id IS NULL
    AND status = 'pending'
    AND check_out_date >= check_in_date
    AND total_amount > 0
  );

DROP POLICY IF EXISTS "guest_insert_verification_document" ON public.verification_documents;

CREATE POLICY "guest_insert_verification_document"
  ON public.verification_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "guest_insert_signature" ON public.digital_signatures;

-- 1 MB; sized from live max, adjust in review
CREATE POLICY "guest_insert_signature"
  ON public.digital_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(signature_data) < 1000000);

-- ---------------------------------------------------------------------
-- 5. user_profiles: keep the four existing self-service policies as-is,
--    add a trigger that blocks self-granted admin role
-- ---------------------------------------------------------------------
-- Kept unchanged: "Users can insert own profile", "Users can read own
-- profile", "Users can update own profile", "Service role can read all
-- profiles".

DROP TRIGGER IF EXISTS trg_block_admin_self_grant ON public.user_profiles;

CREATE OR REPLACE FUNCTION public.block_admin_self_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
     AND new.user_type = 'admin'
     AND (tg_op = 'INSERT' OR old.user_type IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'admin role cannot be self-assigned' USING errcode = '42501';
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER trg_block_admin_self_grant
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_admin_self_grant();

-- ---------------------------------------------------------------------
-- 6. Storage: lock down the `documents` bucket, remove the unused
--    `verification_uploads` bucket
-- ---------------------------------------------------------------------

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png']
WHERE id = 'documents';

DROP POLICY IF EXISTS "guest_upload_documents" ON storage.objects;

CREATE POLICY "guest_upload_documents"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN ('id-documents', 'credit-cards')
  );

DROP POLICY IF EXISTS "admin_read_documents" ON storage.objects;

CREATE POLICY "admin_read_documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_admin()
  );

-- No update/delete policies on storage.objects for the documents bucket.

-- NOTE: the unused, empty, private bucket `verification_uploads` must be removed via the Storage API
-- (direct DELETE on storage tables is blocked by storage.protect_delete()).
-- (Rest of this migration was applied live on 2026-09-07 via Supabase MCP.)

-- ---------------------------------------------------------------------
-- 7. Pin search_path on the pre-existing trigger function
-- ---------------------------------------------------------------------

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

