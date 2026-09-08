/*
  # Phase 1 backfill: attach existing Host LA data to the new tenant model

  What: creates the `host-la` organization, makes the 3 existing
  `user_profiles` admins its owners (and platform admins), creates a
  `properties` row per distinct `reservations.property_slug` (plus a
  catch-all `unassigned` property), points every existing `reservations`
  / `verification_documents` row at that org, and synthesizes a
  `verifications` row for every reservation that doesn't have one yet
  from the legacy `verification_documents`/`reservations` status. Also
  seeds the org's `agreement` document template from the hard-coded
  content in `src/data/rentalAgreement.ts`.

  Why: 20260907300000_tenancy.sql adds the new tables/columns nullable
  so the existing single-tenant app keeps working untouched; this
  migration is what actually makes the existing ~181 reservations
  tenant-scoped instead of orphaned.

  Idempotent: every insert is `ON CONFLICT ... DO NOTHING` or scoped to
  `WHERE ... IS NULL` / `WHERE NOT EXISTS (...)`, so re-running this
  against a database that already ran it once is a no-op (including the
  audit_events summary row, guarded separately below).

  NOT applied to any database by this commit. Review, then apply via the
  Supabase MCP (after 20260907300000_tenancy.sql).
*/

DO $$
DECLARE
  v_org_id uuid;
  v_unassigned_property_id uuid;
  v_reservations_tenanted int := 0;
  v_verifications_created int := 0;
  v_docs_tenanted int := 0;
  v_orphan_docs_tenanted int := 0;
BEGIN
  -- 1. org -----------------------------------------------------------
  INSERT INTO public.organizations (name, slug)
  VALUES ('Host LA', 'host-la')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'host-la';

  -- 2. members: existing admins become owners + platform admins ------
  INSERT INTO public.organization_members (org_id, user_id, role)
  SELECT v_org_id, up.id, 'owner'
  FROM public.user_profiles up
  WHERE up.user_type = 'admin'
  ON CONFLICT (org_id, user_id) DO NOTHING;

  INSERT INTO public.platform_admins (user_id)
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.user_type = 'admin'
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. properties: one per distinct property_slug, plus a catch-all --
  INSERT INTO public.properties (org_id, slug, name)
  SELECT v_org_id, r.property_slug, initcap(replace(r.property_slug, '-', ' '))
  FROM (SELECT DISTINCT property_slug FROM public.reservations WHERE property_slug IS NOT NULL) r
  ON CONFLICT (org_id, slug) DO NOTHING;

  INSERT INTO public.properties (org_id, slug, name)
  VALUES (v_org_id, 'unassigned', 'Unassigned')
  ON CONFLICT (org_id, slug) DO NOTHING;

  SELECT id INTO v_unassigned_property_id
  FROM public.properties
  WHERE org_id = v_org_id AND slug = 'unassigned';

  -- 4. reservations: attach org + property ----------------------------
  -- (source already backfilled to 'open' for every existing row by the
  -- NOT NULL DEFAULT 'open' added in 20260907300000_tenancy.sql.)
  UPDATE public.reservations r
  SET org_id = v_org_id
  WHERE r.org_id IS NULL;
  GET DIAGNOSTICS v_reservations_tenanted = ROW_COUNT;

  UPDATE public.reservations r
  SET property_id = p.id
  FROM public.properties p
  WHERE r.property_id IS NULL
    AND r.org_id = v_org_id
    AND p.org_id = v_org_id
    AND p.slug = r.property_slug;

  UPDATE public.reservations r
  SET property_id = v_unassigned_property_id
  WHERE r.property_id IS NULL
    AND r.org_id = v_org_id;

  -- 5. verifications: one per reservation lacking one ------------------
  -- Plain INSERT, not UPDATE, so the BEFORE UPDATE OF status trigger never
  -- runs here — a synthesized non-'pending' status on a brand-new row is not
  -- a "transition" and does not need to satisfy the status machine.
  -- Status mapping: a document that exists but is still pending review maps
  -- to 'submitted' (reviewable under the fixed edge list); a reservation with
  -- NO document stays 'pending' with submitted_at NULL (no fabricated
  -- submission); verified/rejected map to approved/rejected.
  WITH first_doc AS (
    SELECT DISTINCT ON (vd.reservation_id)
      vd.reservation_id,
      vd.status AS doc_status,
      vd.created_at AS doc_created_at,
      vd.reviewed_by AS doc_reviewed_by,
      vd.reviewed_at AS doc_reviewed_at
    FROM public.verification_documents vd
    WHERE vd.reservation_id IS NOT NULL
    ORDER BY vd.reservation_id, vd.created_at ASC
  )
  INSERT INTO public.verifications (org_id, reservation_id, status, submitted_at, reviewed_by, reviewed_at, created_at)
  SELECT
    v_org_id,
    r.id,
    CASE
      WHEN fd.doc_status = 'verified' THEN 'approved'
      WHEN fd.doc_status = 'rejected' THEN 'rejected'
      WHEN fd.doc_status IS NOT NULL THEN 'submitted'
      WHEN r.status = 'verified' THEN 'approved'
      WHEN r.status = 'rejected' THEN 'rejected'
      ELSE 'pending'
    END,
    fd.doc_created_at,        -- NULL when there is no document; never fabricated
    fd.doc_reviewed_by,
    fd.doc_reviewed_at,
    r.created_at
  FROM public.reservations r
  LEFT JOIN first_doc fd ON fd.reservation_id = r.id
  WHERE r.org_id = v_org_id
    AND NOT EXISTS (SELECT 1 FROM public.verifications v WHERE v.reservation_id = r.id);
  GET DIAGNOSTICS v_verifications_created = ROW_COUNT;

  -- 6. verification_documents: attach org + verification --------------
  -- kind stays NULL on these legacy rows on purpose — Phase 2's
  -- migrate-storage-to-r2 script classifies them into proper kind rows
  -- (id_front from id_document_path, card_front from credit_card_path).
  UPDATE public.verification_documents vd
  SET org_id = v_org_id,
      verification_id = v.id,
      storage_backend = 'supabase'
  FROM public.verifications v
  WHERE vd.org_id IS NULL
    AND v.org_id = v_org_id
    AND v.reservation_id = vd.reservation_id;
  GET DIAGNOSTICS v_docs_tenanted = ROW_COUNT;

  -- 6b. orphan documents (reservation_id IS NULL) have no reservation to
  -- join through, but all pre-tenancy data is Host LA's. Tenant them so they
  -- fall under the org policies and the retention index; verification_id
  -- stays NULL (there is no reservation/verification to attach to).
  UPDATE public.verification_documents vd
  SET org_id = v_org_id, storage_backend = 'supabase'
  WHERE vd.org_id IS NULL;
  GET DIAGNOSTICS v_orphan_docs_tenanted = ROW_COUNT;

  -- 7. document_templates: seed the existing rental agreement text ----
  -- (rendered from src/data/rentalAgreement.ts's sections; {{...}}
  -- placeholders left intact, same interpolation style as that file.)
  INSERT INTO public.document_templates (org_id, kind, version, title, body_md)
  VALUES (
    v_org_id,
    'agreement',
    1,
    'Host LA Rental Agreement',
    $md$## Authorization of Charges

I, {{guestName}}, hereby authorize HOST LA PR to process the charges for my reservation. This authorization applies to the total rental amount and any additional charges incurred during my stay.

## Total Rental Amount

Total of {{totalAmount}} includes all applicable taxes and fees.

## Additional Charges

Any additional charges incurred during the rental period (e.g., damages, extra services) will be charged to the credit card on file.

## Cancellation Policy

Cancellations made within 30 days of check-in ({{checkInDate}}) are NON-refundable.

## No-Show Policy

No-shows are NON-refundable. Date changes will be handled at management discretion based on availability.

## Damage Liability

Guest is responsible for any damages to the property during the rental period and authorizes credit card charges for any necessary repairs or replacements.

## Refund Policy

Eligible refunds will be made to the original payment method only, no exceptions.

## Signature Requirement

Signature on this form must match the signature on the cardholder's government-issued ID.

## Check-In / Check-Out

Check-in after 3:00 PM, check-out by 11:00 AM. Early check-in or late check-out arrangements are subject to availability and may incur additional fees.

## Property Rules

No smoking on the premises. No excessive noise after 10 PM. Maximum occupancy as listed in the reservation. No unauthorized pets. No parties or events without prior written approval.

## Liability Waiver

Host LA is not liable for personal injury, property loss, or damage during the rental period. Guests assume all risk associated with the use of the property and its amenities.

## Chargeback Policy

Chargebacks filed for completed stays will be considered fraud and pursued legally to the fullest extent of the law. By signing this agreement, {{guestName}} acknowledges that initiating a chargeback after completing a stay constitutes a fraudulent claim and agrees to bear all costs associated with dispute resolution, including legal fees.

## Governing Law

This agreement is governed by the laws of the state where the rental property is located. Any disputes arising from this agreement shall be resolved in the appropriate jurisdiction.
$md$
  )
  ON CONFLICT (org_id, kind, version) DO NOTHING;

  -- 8. audit trail (guarded so re-running this migration doesn't log twice)
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events WHERE org_id = v_org_id AND action = 'backfill.phase1'
  ) THEN
    INSERT INTO public.audit_events (org_id, actor_type, action, entity, entity_id, metadata)
    VALUES (
      v_org_id,
      'system',
      'backfill.phase1',
      'organization',
      v_org_id,
      jsonb_build_object(
        'reservations_total', (SELECT count(*) FROM public.reservations WHERE org_id = v_org_id),
        'verifications_total', (SELECT count(*) FROM public.verifications WHERE org_id = v_org_id),
        'verification_documents_total', (SELECT count(*) FROM public.verification_documents WHERE org_id = v_org_id),
        'properties_total', (SELECT count(*) FROM public.properties WHERE org_id = v_org_id),
        'reservations_tenanted_this_run', v_reservations_tenanted,
        'verifications_created_this_run', v_verifications_created,
        'docs_tenanted_this_run', v_docs_tenanted,
        'orphan_docs_tenanted_this_run', v_orphan_docs_tenanted,
        'unlinked_documents_remaining', (SELECT count(*) FROM public.verification_documents WHERE org_id IS NULL)
      )
    );
  END IF;

  RAISE NOTICE 'Phase 1 backfill for org % (host-la): tenanted % reservations, created % verifications, tenanted % docs (+ % orphans); totals now %/%/% (res/ver/docs), % unlinked docs remaining',
    v_org_id,
    v_reservations_tenanted, v_verifications_created, v_docs_tenanted, v_orphan_docs_tenanted,
    (SELECT count(*) FROM public.reservations WHERE org_id = v_org_id),
    (SELECT count(*) FROM public.verifications WHERE org_id = v_org_id),
    (SELECT count(*) FROM public.verification_documents WHERE org_id = v_org_id),
    (SELECT count(*) FROM public.verification_documents WHERE org_id IS NULL);
END $$;

-- verify:
--   select count(*) from public.reservations where org_id is null;                 -- expect 0
--   select count(*) from public.verifications;                                     -- expect = count(*) from public.reservations
--   select count(*) from public.verification_documents where org_id is null;       -- expect 0 (orphans tenanted in step 6b)
--   select status, count(*) from public.verifications group by status;             -- expect approved 115 / rejected 3 / submitted 62 / pending 1
--   select slug, name from public.properties order by slug;
