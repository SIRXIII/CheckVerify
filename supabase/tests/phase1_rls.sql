-- Phase 1 tenancy proof. Run against a fresh local stack:
--   supabase db reset
--   docker exec -i supabase_db_checkverify psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/phase1_rls.sql
-- Every case RAISEs on failure; a clean "ALL PHASE 1 RLS CHECKS PASSED" at the
-- end (and psql exit 0) means the migration behaves. Wrapped in one transaction
-- rolled back at the end, so it leaves no data behind.

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures (as the bootstrap superuser; RLS is bypassed here on purpose).
-- Two orgs, four roles in A, owner+staff in B, one reservation/verification/
-- document/template per org. Fixed UUIDs so cases can reference them.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000001','authenticated','authenticated','a-owner@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000002','authenticated','authenticated','a-admin@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000003','authenticated','authenticated','a-staff@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000004','authenticated','authenticated','a-viewer@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000001','authenticated','authenticated','b-owner@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000003','authenticated','authenticated','b-staff@example.com','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','cccccccc-0000-0000-0000-000000000001','authenticated','authenticated','invitee@example.com','',now(),now());

INSERT INTO public.organizations (id, name, slug) VALUES
 ('a0000000-0000-0000-0000-0000000000aa','Org A','org-a'),
 ('b0000000-0000-0000-0000-0000000000bb','Org B','org-b');

INSERT INTO public.organization_members (org_id, user_id, role) VALUES
 ('a0000000-0000-0000-0000-0000000000aa','aaaaaaaa-0000-0000-0000-000000000001','owner'),
 ('a0000000-0000-0000-0000-0000000000aa','aaaaaaaa-0000-0000-0000-000000000002','admin'),
 ('a0000000-0000-0000-0000-0000000000aa','aaaaaaaa-0000-0000-0000-000000000003','staff'),
 ('a0000000-0000-0000-0000-0000000000aa','aaaaaaaa-0000-0000-0000-000000000004','viewer'),
 ('b0000000-0000-0000-0000-0000000000bb','bbbbbbbb-0000-0000-0000-000000000001','owner'),
 ('b0000000-0000-0000-0000-0000000000bb','bbbbbbbb-0000-0000-0000-000000000003','staff');

INSERT INTO public.properties (id, org_id, slug, name) VALUES
 ('a0000000-0000-0000-0000-0000000000a1','a0000000-0000-0000-0000-0000000000aa','villa-a','Villa A'),
 ('b0000000-0000-0000-0000-0000000000b1','b0000000-0000-0000-0000-0000000000bb','villa-b','Villa B');

INSERT INTO public.reservations (id, org_id, property_id, confirmation_number, guest_name, check_in_date, check_out_date, total_amount, booking_platform, status, source)
VALUES
 ('a0000000-0000-0000-0000-0000000000c1','a0000000-0000-0000-0000-0000000000aa','a0000000-0000-0000-0000-0000000000a1','ORGA1','Guest A','2026-10-01','2026-10-03',100,'Booking.com','pending','import'),
 ('b0000000-0000-0000-0000-0000000000c1','b0000000-0000-0000-0000-0000000000bb','b0000000-0000-0000-0000-0000000000b1','ORGB1','Guest B','2026-10-01','2026-10-03',100,'Booking.com','pending','import');

-- verifications are created automatically by trg_reservations_create_verification
-- when the reservations above are inserted (status 'pending'); do not insert them
-- manually or they collide on the reservation_id unique constraint.

-- one document on org A's reservation so CASE 7 has something to PATCH; the
-- auto-tenant trigger fills org_id/verification_id and flips it to submitted.
INSERT INTO public.verification_documents (reservation_id, id_document_name, id_document_path, credit_card_name, credit_card_path, status)
VALUES ('a0000000-0000-0000-0000-0000000000c1','id.png','id-documents/a.png','card.png','credit-cards/a.png','pending');

INSERT INTO public.document_templates (id, org_id, kind, version, title, body_md) VALUES
 ('a0000000-0000-0000-0000-0000000000e1','a0000000-0000-0000-0000-0000000000aa','agreement',1,'A','body');

-- helper: run a query as a given role + user, return it to superuser after
CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid uuid, p_role text, p_email text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', p_role, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role, 'email', p_email)::text, true);
END $$;

-- ===========================================================================
DO $$
DECLARE n int;
BEGIN
  -- CASE 1: org A viewer cannot read any of org B's rows -------------------
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004','authenticated');
  SELECT count(*) INTO n FROM public.reservations WHERE org_id = 'b0000000-0000-0000-0000-0000000000bb';
  IF n <> 0 THEN RAISE EXCEPTION 'CASE 1a: A viewer read % of B reservations', n; END IF;
  SELECT count(*) INTO n FROM public.verifications WHERE org_id = 'b0000000-0000-0000-0000-0000000000bb';
  IF n <> 0 THEN RAISE EXCEPTION 'CASE 1b: A viewer read % of B verifications', n; END IF;
  SELECT count(*) INTO n FROM public.properties WHERE org_id = 'b0000000-0000-0000-0000-0000000000bb';
  IF n <> 0 THEN RAISE EXCEPTION 'CASE 1c: A viewer read % of B properties', n; END IF;
  -- and CAN read its own org
  SELECT count(*) INTO n FROM public.reservations WHERE org_id = 'a0000000-0000-0000-0000-0000000000aa';
  IF n <> 1 THEN RAISE EXCEPTION 'CASE 1d: A viewer sees % own reservations (want 1)', n; END IF;
  RESET ROLE;
  RAISE NOTICE 'CASE 1 pass: tenant read isolation';
END $$;

DO $$
BEGIN
  -- CASE 2: viewer cannot write -------------------------------------------
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004','authenticated');
  BEGIN
    INSERT INTO public.properties (org_id, slug, name)
    VALUES ('a0000000-0000-0000-0000-0000000000aa','viewer-made','x');
    RESET ROLE;
    RAISE EXCEPTION 'CASE 2: viewer INSERT into properties was allowed';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL; -- expected: RLS WITH CHECK rejected it
  END;
  RESET ROLE;
  RAISE NOTICE 'CASE 2 pass: viewer cannot write';
END $$;

DO $$
DECLARE n int;
BEGIN
  -- CASE 3: an admin cannot mint/settle an owner --------------------------
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','authenticated');
  -- promote self to owner: WITH CHECK (role='owner' requires owner) raises
  BEGIN
    UPDATE public.organization_members SET role = 'owner'
     WHERE org_id = 'a0000000-0000-0000-0000-0000000000aa' AND user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
    RESET ROLE;
    RAISE EXCEPTION 'CASE 3a: admin promoted itself to owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; -- expected: RLS WITH CHECK
  RESET ROLE;
  SELECT count(*) INTO n FROM public.organization_members
   WHERE org_id = 'a0000000-0000-0000-0000-0000000000aa' AND user_id = 'aaaaaaaa-0000-0000-0000-000000000002' AND role = 'owner';
  IF n <> 0 THEN RAISE EXCEPTION 'CASE 3a: admin is now owner'; END IF;
  -- admin cannot delete the existing owner's row (USING excludes owner rows)
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','authenticated');
  DELETE FROM public.organization_members
   WHERE org_id = 'a0000000-0000-0000-0000-0000000000aa' AND user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  RESET ROLE;
  SELECT count(*) INTO n FROM public.organization_members
   WHERE org_id = 'a0000000-0000-0000-0000-0000000000aa' AND user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 1 THEN RAISE EXCEPTION 'CASE 3b: admin deleted an owner'; END IF;
  RAISE NOTICE 'CASE 3 pass: owner tier enforced';
END $$;

DO $$
BEGIN
  -- CASE 4: the last owner cannot leave -----------------------------------
  PERFORM pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000001','authenticated');
  BEGIN
    DELETE FROM public.organization_members
     WHERE org_id = 'b0000000-0000-0000-0000-0000000000bb' AND user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
    RESET ROLE;
    RAISE EXCEPTION 'CASE 4: the last owner of org B was allowed to leave';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: last-owner trigger raised 42501
  END;
  RESET ROLE;
  RAISE NOTICE 'CASE 4 pass: last owner protected';
END $$;

DO $$
BEGIN
  -- CASE 5: an anon insert may not choose a foreign org -------------------
  PERFORM pg_temp.as_user(NULL, 'anon');
  BEGIN
    INSERT INTO public.reservations (org_id, confirmation_number, guest_name, check_in_date, check_out_date, total_amount, booking_platform, status)
    VALUES ('b0000000-0000-0000-0000-0000000000bb','HACK1','Mallory','2026-10-01','2026-10-03',1,'Other','pending');
    RESET ROLE;
    RAISE EXCEPTION 'CASE 5: anon inserted a reservation into a foreign org';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected: reservations_auto_tenant() raised 42501
  END;
  RESET ROLE;
  RAISE NOTICE 'CASE 5 pass: anon cannot pick a tenant';
END $$;

-- CASE 6: the real ihostla.com anon insert is auto-tenanted. Run as
-- TOP-LEVEL statements under SET LOCAL ROLE, exactly how PostgREST issues
-- them in production (a BEFORE-trigger + RLS WITH CHECK insert behaves
-- differently when wrapped in a plpgsql DO block, which production never is).
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"sub":null,"role":"anon"}', true);
INSERT INTO public.reservations (id, confirmation_number, guest_name, guest_email, check_in_date, check_out_date, total_amount, booking_platform, property_slug, status)
VALUES ('c6c6c6c6-0000-0000-0000-000000000001','HLATESTX','Guest','g@example.com','2026-10-01','2026-10-03',100,'Booking.com','unassigned','pending');
INSERT INTO public.verification_documents (reservation_id, id_document_name, id_document_path, credit_card_name, credit_card_path, status)
VALUES ('c6c6c6c6-0000-0000-0000-000000000001','id.png','id-documents/x.png','card.png','credit-cards/x.png','pending');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
DO $$
DECLARE v_ver public.verifications; v_host uuid;
BEGIN
  SELECT id INTO v_host FROM public.organizations WHERE slug = 'host-la';
  PERFORM 1 FROM public.reservations WHERE id = 'c6c6c6c6-0000-0000-0000-000000000001' AND org_id = v_host AND property_id IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE 6a: anon reservation was not auto-tenanted'; END IF;
  SELECT * INTO v_ver FROM public.verifications WHERE reservation_id = 'c6c6c6c6-0000-0000-0000-000000000001';
  IF v_ver.id IS NULL OR v_ver.status <> 'submitted' OR v_ver.submitted_at IS NULL THEN
    RAISE EXCEPTION 'CASE 6: verification did not reach submitted (%).', coalesce(v_ver.status,'<none>'); END IF;
  RAISE NOTICE 'CASE 6 pass: legacy anon insert auto-tenanted + verification submitted';
END $$;

DO $$
DECLARE v_ver public.verifications;
BEGIN
  -- CASE 7: the ihostla admin PATCH (service_role) syncs to approved ------
  -- exactly what api/admin/verifications/[id].ts PATCH sends: status only
  PERFORM pg_temp.as_user(NULL, 'service_role');
  UPDATE public.verification_documents SET status = 'verified'
    WHERE reservation_id = 'a0000000-0000-0000-0000-0000000000c1';
  RESET ROLE;
  SELECT * INTO v_ver FROM public.verifications WHERE reservation_id = 'a0000000-0000-0000-0000-0000000000c1';
  IF v_ver.status <> 'approved' THEN RAISE EXCEPTION 'CASE 7a: legacy verified did not sync to approved (%).', v_ver.status; END IF;
  -- idempotent: a second identical PATCH does not error or flip anything
  PERFORM pg_temp.as_user(NULL, 'service_role');
  UPDATE public.verification_documents SET status = 'verified'
    WHERE reservation_id = 'a0000000-0000-0000-0000-0000000000c1';
  RESET ROLE;
  SELECT * INTO v_ver FROM public.verifications WHERE reservation_id = 'a0000000-0000-0000-0000-0000000000c1';
  IF v_ver.status <> 'approved' THEN RAISE EXCEPTION 'CASE 7b: idempotent sync changed status'; END IF;
  RAISE NOTICE 'CASE 7 pass: legacy status sync + idempotent';
END $$;

DO $$
DECLARE v_token text;
BEGIN
  -- CASE 8: invites are bound to the invited email ------------------------
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','authenticated','a-admin@example.com');
  v_token := public.create_invite('a0000000-0000-0000-0000-0000000000aa','invitee@example.com','viewer');
  RESET ROLE;
  IF v_token IS NULL OR length(v_token) <> 64 THEN RAISE EXCEPTION 'CASE 8a: create_invite did not return a 64-hex token'; END IF;
  -- wrong email cannot accept
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000003','authenticated','a-staff@example.com');
  BEGIN
    PERFORM public.accept_invite(v_token);
    RESET ROLE;
    RAISE EXCEPTION 'CASE 8b: a different email accepted the invite';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- right email joins
  PERFORM pg_temp.as_user('cccccccc-0000-0000-0000-000000000001','authenticated','invitee@example.com');
  PERFORM public.accept_invite(v_token);
  RESET ROLE;
  PERFORM 1 FROM public.organization_members
   WHERE org_id='a0000000-0000-0000-0000-0000000000aa' AND user_id='cccccccc-0000-0000-0000-000000000001' AND role='viewer';
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE 8c: invitee did not join'; END IF;
  RAISE NOTICE 'CASE 8 pass: invite email binding + create_invite pgcrypto works';
END $$;

DO $$
BEGIN
  -- CASE 9: authenticated cannot forge audit rows -------------------------
  PERFORM pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002','authenticated');
  BEGIN
    PERFORM public.log_audit('a0000000-0000-0000-0000-0000000000aa','user','aaaaaaaa-0000-0000-0000-000000000002','forged','x',NULL);
    RESET ROLE;
    RAISE EXCEPTION 'CASE 9: authenticated executed log_audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; -- no EXECUTE grant
  RESET ROLE;
  RAISE NOTICE 'CASE 9 pass: log_audit is not callable by authenticated';
END $$;

DO $$
DECLARE v_ver_a uuid;
BEGIN
  -- CASE 10: a child row cannot reference a parent in another org ----------
  -- org B tries to hang a document off org A's verification. service_role
  -- bypasses RLS, so this proves the composite FK (not a policy) stops it.
  SELECT id INTO v_ver_a FROM public.verifications WHERE reservation_id = 'a0000000-0000-0000-0000-0000000000c1';
  PERFORM pg_temp.as_user(NULL, 'service_role');
  BEGIN
    INSERT INTO public.verification_documents (org_id, verification_id, kind, storage_path, status)
    VALUES ('b0000000-0000-0000-0000-0000000000bb', v_ver_a, 'id_front', 'x', 'pending');
    RESET ROLE;
    RAISE EXCEPTION 'CASE 10: cross-org verification_documents insert was allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END; -- composite FK rejected it
  RESET ROLE;
  RAISE NOTICE 'CASE 10 pass: composite FK blocks cross-org reference';
END $$;

DO $$ BEGIN RAISE NOTICE '=== ALL PHASE 1 RLS CHECKS PASSED ==='; END $$;

ROLLBACK;
