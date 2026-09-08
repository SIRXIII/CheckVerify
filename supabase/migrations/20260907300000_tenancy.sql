/*
  # Phase 1: multi-tenant foundation

  What: introduces the organization/property/verification data model that
  Check-In Verify needs to become multi-tenant (SaaS), on top of the
  existing single-tenant tables (`reservations`, `verification_documents`,
  `digital_signatures`, `user_profiles`). Specifically:

    1. New tables: `organizations`, `organization_members`,
       `organization_invites`, `platform_admins`, `properties`,
       `verifications`, `audit_events`, `guest_links`,
       `document_templates`, `consents`.
    2. New columns on the existing `reservations` and
       `verification_documents` tables so they can be tied to an org and
       (for documents) to a `verifications` row and durable storage
       metadata.
    3. Helper functions (`is_platform_admin`, `current_org_ids`,
       `has_org_role`, `my_memberships`) and action functions
       (`create_organization`, `create_invite`, `accept_invite`,
       `transition_verification`, `dashboard_counts`, `log_audit`) that
       encapsulate the tenancy rules so RLS policies and app code both
       call into a single definition of "who can do what."
    4. A status-machine trigger on `verifications` (`pending` ->
       `submitted` -> `auto_approved`/`needs_review` -> `approved`/
       `rejected` -> `expired`, with `deleted` reachable from anywhere
       but only for service-role/background jobs) plus an audit-log
       trigger that records every status change.
    5. RLS on every new table, plus additional org-scoped policies added
       *alongside* (not replacing) the existing lockdown_v1 policies on
       `reservations` and `verification_documents`.

  Why now: this is the schema groundwork for turning the single-tenant
  Host LA verification flow into a multi-tenant product. Nothing existing
  is dropped or renamed in this phase — `org_id`/`property_id`/
  `verification_id` columns are added nullable so the current app keeps
  working unmodified, and the 20260907300100 backfill migration populates
  them for the existing Host LA data.

  Style: `text` + CHECK constraints instead of enums (matches the rest of
  this schema), `IF NOT EXISTS` guards throughout so this is safe to
  re-run, `SECURITY DEFINER` functions always pin `search_path = public`.
  Written for Postgres 17 / Supabase.

  NOT applied to any database by this commit. Review, then apply via the
  Supabase MCP.
*/


-- =======================================================================
-- 1. TABLES
-- =======================================================================

-- ---------------------------------------------------------------------
-- organizations: the tenant. One row per customer account.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'growth', 'enterprise')),
  plan_status text NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active', 'past_due', 'canceled')),
  trial_ends_at timestamptz DEFAULT now() + interval '14 days',
  retention_days_images int NOT NULL DEFAULT 180,
  retention_days_signature int NOT NULL DEFAULT 730,
  retention_days_pii int NOT NULL DEFAULT 730,
  retention_days_unsubmitted int NOT NULL DEFAULT 30,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- organization_members: who belongs to an org and at what role.
-- No surrogate id — (org_id, user_id) is the natural key.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- ---------------------------------------------------------------------
-- organization_invites: pending invitations. Only the sha256 hash of the
-- raw invite token is stored (same pattern as password reset tokens) so
-- a leaked row in this table can't be used to accept the invite.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- platform_admins: us, not the customer. Separate from org roles so
-- "can see every org for support" isn't tangled up with "owns an org."
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- properties: a physical listing/unit an org verifies guests for.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{1,60}$'),
  name text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  check_in_instructions text,
  release_instructions_on_approval boolean NOT NULL DEFAULT true,
  verification_rules jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- ---------------------------------------------------------------------
-- reservations: tie existing rows into the tenant model. Nullable so the
-- current single-tenant app keeps working; the Phase 1 backfill
-- migration populates these for existing rows.
-- ---------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'open' CHECK (source IN ('link', 'open', 'import', 'api')),
  ADD COLUMN IF NOT EXISTS guest_phone text;

CREATE INDEX IF NOT EXISTS idx_reservations_org_created_at ON public.reservations (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON public.reservations (property_id);

-- ---------------------------------------------------------------------
-- verifications: the review workflow, separated out from `reservations`
-- so a reservation can exist before a verification is started and so
-- the status machine below has a single row to own.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'submitted', 'auto_approved', 'needs_review', 'approved', 'rejected', 'expired', 'deleted')
  ),
  risk_score int,
  risk_flags jsonb NOT NULL DEFAULT '[]',
  submitted_at timestamptz,
  submitted_ip inet,
  submitted_user_agent text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  decision_reason text,
  instructions_released_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifications_org_status ON public.verifications (org_id, status);
CREATE INDEX IF NOT EXISTS idx_verifications_org_created_at ON public.verifications (org_id, created_at DESC);

-- ---------------------------------------------------------------------
-- verification_documents: add tenant + verification linkage and durable
-- storage metadata (bytes/sha256/purge_after) needed once documents can
-- live in R2 instead of Supabase Storage. `kind` stays nullable for
-- existing rows — Phase 2's storage migration classifies them.
-- ---------------------------------------------------------------------
ALTER TABLE public.verification_documents
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS verification_id uuid REFERENCES public.verifications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text CHECK (kind IN ('id_front', 'id_back', 'selfie', 'card_front', 'signature', 'other')),
  -- ponytail: default 'supabase' because that is where every current writer
  -- (both guest forms) puts the bytes; Phase 2's R2 migration flips this default.
  ADD COLUMN IF NOT EXISTS storage_backend text NOT NULL DEFAULT 'supabase' CHECK (storage_backend IN ('supabase', 'r2')),
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS bytes int,
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS purge_after date,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id ON public.verification_documents (verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_org_purge_after
  ON public.verification_documents (org_id, purge_after)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- audit_events: append-only trail. bigint identity instead of uuid
-- since these are only ever read in created_at order, never referenced
-- by other rows.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'guest', 'system')),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip inet,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_created_at ON public.audit_events (org_id, created_at DESC);

-- ---------------------------------------------------------------------
-- guest_links: shareable, expiring links to a specific reservation's
-- verification flow (replaces "anyone with the confirmation number").
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- document_templates: versioned legal text (agreement, house rules,
-- etc). `consents` below points at a specific version so re-editing a
-- template never changes what a guest already agreed to.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('agreement', 'house_rules', 'damage_waiver', 'checkin_requirements')),
  version int NOT NULL DEFAULT 1,
  title text NOT NULL,
  body_md text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, kind, version)
);

-- ---------------------------------------------------------------------
-- consents: proof a guest agreed to a specific template version.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  verification_id uuid NOT NULL REFERENCES public.verifications(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.document_templates(id),
  version int NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  signature_document_id uuid REFERENCES public.verification_documents(id),
  created_at timestamptz DEFAULT now()
);


-- =======================================================================
-- 2. updated_at triggers (reuse the existing public.update_updated_at_column())
-- =======================================================================

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_verifications_updated_at ON public.verifications;
CREATE TRIGGER update_verifications_updated_at
  BEFORE UPDATE ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =======================================================================
-- 3. HELPER FUNCTIONS
--    All SECURITY DEFINER + search_path pinned so they read tables the
--    calling role may not have RLS visibility into (same pattern as the
--    existing public.is_admin()). Only authenticated/service_role can
--    execute them — anon never evaluates an org-scoped policy.
-- =======================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org uuid, p_min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.org_id = p_org
        AND m.user_id = auth.uid()
        AND (CASE m.role
              WHEN 'owner' THEN 4
              WHEN 'admin' THEN 3
              WHEN 'staff' THEN 2
              WHEN 'viewer' THEN 1
            END)
          >=
            (CASE p_min_role
              WHEN 'owner' THEN 4
              WHEN 'admin' THEN 3
              WHEN 'staff' THEN 2
              WHEN 'viewer' THEN 1
            END)
    );
$$;

REVOKE ALL ON FUNCTION public.has_org_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_memberships()
RETURNS TABLE (org_id uuid, slug text, name text, role text, plan text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.slug, o.name, m.role, o.plan
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_memberships() TO authenticated, service_role;


-- =======================================================================
-- 4. ACTION FUNCTIONS
-- =======================================================================

-- create_organization: bootstraps a new tenant. Deliberately does not
-- create a default property — an empty org with zero properties is a
-- valid, unambiguous state, and the app can prompt for the first
-- property as a separate step.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, auth.uid(), 'owner');

  INSERT INTO public.audit_events (org_id, actor_type, actor_id, action, entity, entity_id)
  VALUES (v_org_id, 'user', auth.uid(), 'org.created', 'organization', v_org_id);

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;

-- create_invite: only the sha256 hash is persisted; the raw hex token is
-- returned once so the caller can put it in an email link. Email is
-- deliberately excluded from the audit metadata (PII minimization).
CREATE OR REPLACE FUNCTION public.create_invite(p_org uuid, p_email text, p_role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw bytea;
  v_token text;
  v_hash text;
  v_invite_id uuid;
BEGIN
  IF NOT public.has_org_role(p_org, 'admin') THEN
    RAISE EXCEPTION 'insufficient role to invite members' USING ERRCODE = '42501';
  END IF;
  -- you can only grant a role you already hold (an admin cannot mint owner invites)
  IF NOT public.has_org_role(p_org, p_role) THEN
    RAISE EXCEPTION 'cannot invite at a role higher than your own' USING ERRCODE = '42501';
  END IF;

  -- pgcrypto lives in the `extensions` schema on Supabase; search_path is pinned
  -- to public, so these must be schema-qualified or they fail at first call.
  v_raw := extensions.gen_random_bytes(32);
  v_token := encode(v_raw, 'hex');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  INSERT INTO public.organization_invites (org_id, email, role, token_hash, created_by)
  VALUES (p_org, p_email, p_role, v_hash, auth.uid())
  RETURNING id INTO v_invite_id;

  INSERT INTO public.audit_events (org_id, actor_type, actor_id, action, entity, entity_id, metadata)
  VALUES (p_org, 'user', auth.uid(), 'member.invited', 'organization_invite', v_invite_id, jsonb_build_object('role', p_role));

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invite(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid, text, text) TO authenticated;

-- accept_invite: raw hex token in, re-hashed and matched against
-- token_hash. ON CONFLICT lets a re-invite with a different role win.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_invite public.organization_invites;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  v_hash := encode(extensions.digest(decode(p_token, 'hex'), 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token_hash = v_hash
    AND expires_at > now()
    AND accepted_at IS NULL;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invite not found or expired' USING ERRCODE = 'P0002';
  END IF;

  -- an invite is for the email it was sent to, not whoever holds the link
  IF lower(v_invite.email) IS DISTINCT FROM lower(coalesce(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'this invite was issued to a different email address' USING ERRCODE = '42501';
  END IF;

  -- existing members keep their role; re-invites never silently demote/upgrade
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_invite.org_id, auth.uid(), v_invite.role)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.organization_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.audit_events (org_id, actor_type, actor_id, action, entity, entity_id)
  VALUES (v_invite.org_id, 'user', auth.uid(), 'member.joined', 'organization_member', auth.uid());

  RETURN v_invite.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- transition_verification: the only sanctioned way to change a
-- verification's status. Legality of the transition itself is enforced
-- by the trigger below, not here — this function only checks role and
-- applies the side effects (reviewed_by/at, instructions_released_at).
CREATE OR REPLACE FUNCTION public.transition_verification(p_id uuid, p_to text, p_reason text DEFAULT NULL)
RETURNS public.verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_current text;
  v_release boolean;
  v_row public.verifications;
BEGIN
  -- clients only ever drive the human-decision states; submitted/auto_approved/
  -- expired/deleted are reached by the guest flow, the risk engine, or retention.
  IF p_to NOT IN ('needs_review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'transition_verification: clients may only set needs_review, approved or rejected' USING ERRCODE = '22023';
  END IF;

  SELECT v.org_id, v.status INTO v_org, v_current FROM public.verifications v WHERE v.id = p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'verification % not found', p_id;
  END IF;

  IF NOT public.has_org_role(v_org, 'staff') THEN
    RAISE EXCEPTION 'insufficient role for verification transition' USING ERRCODE = '42501';
  END IF;

  -- idempotent: a retry that asks for the state we are already in is a no-op
  IF v_current = p_to THEN
    SELECT v.* INTO v_row FROM public.verifications v WHERE v.id = p_id;
    RETURN v_row;
  END IF;

  SELECT p.release_instructions_on_approval INTO v_release
  FROM public.verifications v
  JOIN public.reservations r ON r.id = v.reservation_id
  LEFT JOIN public.properties p ON p.id = r.property_id
  WHERE v.id = p_id;

  UPDATE public.verifications
  SET status = p_to,
      reviewed_by = CASE WHEN p_to IN ('approved', 'rejected') THEN auth.uid() ELSE reviewed_by END,
      reviewed_at = CASE WHEN p_to IN ('approved', 'rejected') THEN now() ELSE reviewed_at END,
      decision_reason = coalesce(p_reason, decision_reason),
      instructions_released_at = CASE WHEN p_to = 'approved' AND coalesce(v_release, true) THEN now() ELSE instructions_released_at END,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_verification(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_verification(uuid, text, text) TO authenticated;

-- dashboard_counts: status breakdown for an org's verifications.
CREATE OR REPLACE FUNCTION public.dashboard_counts(p_org uuid)
RETURNS TABLE (status text, n bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role(p_org, 'viewer') THEN
    RAISE EXCEPTION 'insufficient role for dashboard_counts' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT v.status, count(*) AS n
    FROM public.verifications v
    WHERE v.org_id = p_org
    GROUP BY v.status;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_counts(uuid) TO authenticated, service_role;

-- log_audit: plain insert helper for server-side code (edge functions,
-- scripts) running with the service role. Client roles never call this
-- directly — the action functions above write their own audit rows.
CREATE OR REPLACE FUNCTION public.log_audit(
  p_org uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}',
  p_ip inet DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- defense in depth: even if a grant slips, only server-side (service_role)
  -- or in-DB (NULL role: triggers/functions) callers may write audit rows.
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.role() IS NOT NULL THEN
    RAISE EXCEPTION 'log_audit is service_role only' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.audit_events (org_id, actor_type, actor_id, action, entity, entity_id, metadata, ip)
  VALUES (p_org, p_actor_type, p_actor_id, p_action, p_entity, p_entity_id, p_metadata, p_ip);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit(uuid, text, uuid, text, text, uuid, jsonb, inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, uuid, text, text, uuid, jsonb, inet) TO service_role;


-- =======================================================================
-- 5. verifications status machine
-- =======================================================================

-- BEFORE UPDATE OF status: rejects any transition not on the allowed
-- edge list. Same-status updates (status included in the SET list but
-- unchanged) are treated as a no-op, not a transition, so idempotent
-- retries of transition_verification don't fail.
CREATE OR REPLACE FUNCTION public.verifications_enforce_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  -- -> deleted: from a finished state (approved/rejected/expired) any caller
  -- with UPDATE rights may soft-delete; from any other state it is a
  -- background/service-role-only action (retention purge).
  IF new.status = 'deleted' THEN
    IF old.status NOT IN ('approved', 'rejected', 'expired')
       AND v_role IS NOT NULL AND v_role <> 'service_role' THEN
      RAISE EXCEPTION 'invalid verification transition % -> %', old.status, new.status USING ERRCODE = '22023';
    END IF;
    RETURN new;
  END IF;

  -- A human decision (approved/rejected) may be reached directly from any
  -- pre-decision state: there is no risk engine yet, so no auto_approved/
  -- needs_review hop is required, and the legacy-status sync writes here too.
  IF (old.status = 'pending' AND new.status = 'submitted')
     OR (old.status = 'submitted' AND new.status IN ('auto_approved', 'needs_review'))
     OR (old.status IN ('pending', 'submitted', 'auto_approved', 'needs_review') AND new.status IN ('approved', 'rejected'))
     OR (old.status IN ('approved', 'rejected') AND new.status = 'expired')
  THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'invalid verification transition % -> %', old.status, new.status USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS trg_verifications_enforce_transition ON public.verifications;
CREATE TRIGGER trg_verifications_enforce_transition
  BEFORE UPDATE OF status ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.verifications_enforce_transition();

-- AFTER UPDATE OF status: records every status change that made it past
-- the trigger above.
CREATE OR REPLACE FUNCTION public.verifications_log_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    INSERT INTO public.audit_events (org_id, actor_type, actor_id, action, entity, entity_id, metadata)
    VALUES (
      new.org_id,
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
      auth.uid(),
      'verification.status_changed',
      'verification',
      new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'reason', new.decision_reason)
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_verifications_log_transition ON public.verifications;
CREATE TRIGGER trg_verifications_log_transition
  AFTER UPDATE OF status ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.verifications_log_transition();


-- =======================================================================
-- 6. RLS
-- =======================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- organizations: membership grants read; admin+ grants update. No
-- direct insert/delete policy — create_organization() (SECURITY
-- DEFINER) is the only sanctioned way to create one.
DROP POLICY IF EXISTS "org_select_organizations" ON public.organizations;
CREATE POLICY "org_select_organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "org_update_organizations" ON public.organizations;
CREATE POLICY "org_update_organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, 'admin'))
  WITH CHECK (public.has_org_role(id, 'admin'));

-- organization_members: any member of the org can see its roster;
-- admins manage it; a user may always remove their own membership row.
DROP POLICY IF EXISTS "org_select_organization_members" ON public.organization_members;
CREATE POLICY "org_select_organization_members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

-- Owner tier is only meaningful if an admin cannot write an 'owner' row or
-- touch an existing one: every clause gates the owner role behind owner rank.
DROP POLICY IF EXISTS "org_insert_organization_members" ON public.organization_members;
CREATE POLICY "org_insert_organization_members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, 'admin')
    AND (role <> 'owner' OR public.has_org_role(org_id, 'owner'))
  );

DROP POLICY IF EXISTS "org_update_organization_members" ON public.organization_members;
CREATE POLICY "org_update_organization_members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, 'admin')
    AND (role <> 'owner' OR public.has_org_role(org_id, 'owner'))
  )
  WITH CHECK (
    public.has_org_role(org_id, 'admin')
    AND (role <> 'owner' OR public.has_org_role(org_id, 'owner'))
  );

DROP POLICY IF EXISTS "org_delete_organization_members" ON public.organization_members;
CREATE POLICY "org_delete_organization_members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()  -- always allowed to leave
    OR (
      public.has_org_role(org_id, 'admin')
      AND (role <> 'owner' OR public.has_org_role(org_id, 'owner'))
    )
  );

-- organization_invites: admin-only in every direction.
DROP POLICY IF EXISTS "org_select_organization_invites" ON public.organization_invites;
CREATE POLICY "org_select_organization_invites"
  ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

DROP POLICY IF EXISTS "org_insert_organization_invites" ON public.organization_invites;
CREATE POLICY "org_insert_organization_invites"
  ON public.organization_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'admin'));

DROP POLICY IF EXISTS "org_update_organization_invites" ON public.organization_invites;
CREATE POLICY "org_update_organization_invites"
  ON public.organization_invites FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'admin'))
  WITH CHECK (public.has_org_role(org_id, 'admin'));

DROP POLICY IF EXISTS "org_delete_organization_invites" ON public.organization_invites;
CREATE POLICY "org_delete_organization_invites"
  ON public.organization_invites FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

-- platform_admins: you can see that you are one; nothing else client-side.
DROP POLICY IF EXISTS "platform_admins_select_own" ON public.platform_admins;
CREATE POLICY "platform_admins_select_own"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- properties: standard tenant pattern (member read, staff write, admin delete).
DROP POLICY IF EXISTS "org_select_properties" ON public.properties;
CREATE POLICY "org_select_properties"
  ON public.properties FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "org_insert_properties" ON public.properties;
CREATE POLICY "org_insert_properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_update_properties" ON public.properties;
CREATE POLICY "org_update_properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_delete_properties" ON public.properties;
CREATE POLICY "org_delete_properties"
  ON public.properties FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

-- verifications: standard tenant pattern.
DROP POLICY IF EXISTS "org_select_verifications" ON public.verifications;
CREATE POLICY "org_select_verifications"
  ON public.verifications FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "org_insert_verifications" ON public.verifications;
CREATE POLICY "org_insert_verifications"
  ON public.verifications FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_update_verifications" ON public.verifications;
CREATE POLICY "org_update_verifications"
  ON public.verifications FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_delete_verifications" ON public.verifications;
CREATE POLICY "org_delete_verifications"
  ON public.verifications FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

-- audit_events: read-only for org members (viewer+); every row is
-- written by a SECURITY DEFINER function or the transition trigger.
DROP POLICY IF EXISTS "org_select_audit_events" ON public.audit_events;
CREATE POLICY "org_select_audit_events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, 'viewer'));

-- guest_links: staff can create/see/update; only admin can delete.
DROP POLICY IF EXISTS "org_select_guest_links" ON public.guest_links;
CREATE POLICY "org_select_guest_links"
  ON public.guest_links FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_insert_guest_links" ON public.guest_links;
CREATE POLICY "org_insert_guest_links"
  ON public.guest_links FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_update_guest_links" ON public.guest_links;
CREATE POLICY "org_update_guest_links"
  ON public.guest_links FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_delete_guest_links" ON public.guest_links;
CREATE POLICY "org_delete_guest_links"
  ON public.guest_links FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

-- document_templates: any member can read; staff write; admin delete.
DROP POLICY IF EXISTS "org_select_document_templates" ON public.document_templates;
CREATE POLICY "org_select_document_templates"
  ON public.document_templates FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, 'viewer'));

DROP POLICY IF EXISTS "org_insert_document_templates" ON public.document_templates;
CREATE POLICY "org_insert_document_templates"
  ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_update_document_templates" ON public.document_templates;
CREATE POLICY "org_update_document_templates"
  ON public.document_templates FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_delete_document_templates" ON public.document_templates;
CREATE POLICY "org_delete_document_templates"
  ON public.document_templates FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, 'admin'));

-- consents: append-only proof of agreement. Members can read, staff can
-- record one; no update/delete policy for any client role.
DROP POLICY IF EXISTS "org_select_consents" ON public.consents;
CREATE POLICY "org_select_consents"
  ON public.consents FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, 'viewer'));

DROP POLICY IF EXISTS "org_insert_consents" ON public.consents;
CREATE POLICY "org_insert_consents"
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

-- reservations / verification_documents: ADD org-scoped policies
-- alongside the existing guest_insert_*/admin_*_* policies from
-- lockdown_v1. Nothing from that migration is dropped here.
DROP POLICY IF EXISTS "org_select_reservations" ON public.reservations;
CREATE POLICY "org_select_reservations"
  ON public.reservations FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

-- Postgres policy names must be unique per table regardless of command,
-- so the single "org_write_reservations" name from spec is split into
-- an _insert and _update policy (see report for the full deviation note).
DROP POLICY IF EXISTS "org_write_reservations_insert" ON public.reservations;
CREATE POLICY "org_write_reservations_insert"
  ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_write_reservations_update" ON public.reservations;
CREATE POLICY "org_write_reservations_update"
  ON public.reservations FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_select_verification_documents" ON public.verification_documents;
CREATE POLICY "org_select_verification_documents"
  ON public.verification_documents FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_org_ids()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "org_write_verification_documents_insert" ON public.verification_documents;
CREATE POLICY "org_write_verification_documents_insert"
  ON public.verification_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, 'staff'));

DROP POLICY IF EXISTS "org_write_verification_documents_update" ON public.verification_documents;
CREATE POLICY "org_write_verification_documents_update"
  ON public.verification_documents FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, 'staff'))
  WITH CHECK (public.has_org_role(org_id, 'staff'));


-- =======================================================================
-- 7. GRANTS
--    Table-level grants stay broad (matches the existing Supabase
--    default noted in the live catalog: anon/authenticated get full
--    table grants and RLS is the only real gate). anon gets nothing on
--    any of the new tables.
-- =======================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.organizations,
  public.organization_members,
  public.organization_invites,
  public.platform_admins,
  public.properties,
  public.verifications,
  public.audit_events,
  public.guest_links,
  public.document_templates,
  public.consents
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =======================================================================
-- 8. PHASE-1 REVIEW FIXES (2026-09-08)
--    Everything below hardens the sections above against the adversarial
--    review. Placed at the end because it references tables/functions
--    already defined; runtime triggers only fire on post-migration writes.
-- =======================================================================

-- --- 8.1 Seed the Host LA tenant IN THIS migration ---------------------
-- so is_admin() -> is_platform_admin() (8.2) never leaves the 3 legacy
-- admins locked out in the window before the backfill runs. Idempotent;
-- the backfill's steps 1-2 become no-ops.
DO $$
DECLARE v_org uuid;
BEGIN
  INSERT INTO public.organizations (name, slug) VALUES ('Host LA', 'host-la')
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'host-la';
  INSERT INTO public.properties (org_id, slug, name) VALUES (v_org, 'unassigned', 'Unassigned')
    ON CONFLICT (org_id, slug) DO NOTHING;
  INSERT INTO public.organization_members (org_id, user_id, role)
    SELECT v_org, id, 'owner' FROM public.user_profiles WHERE user_type = 'admin'
    ON CONFLICT (org_id, user_id) DO NOTHING;
  INSERT INTO public.platform_admins (user_id)
    SELECT id FROM public.user_profiles WHERE user_type = 'admin'
    ON CONFLICT (user_id) DO NOTHING;
END $$;

-- --- 8.2 One definition of "sees every org" ---------------------------
-- is_admin() (referenced by the lockdown_v1 admin_* policies) becomes an
-- alias for is_platform_admin(), so cross-tenant read/write is governed by
-- platform_admins alone, not by a second user_profiles.user_type concept.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_platform_admin(); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- --- 8.3 Auto-tenant legacy/guest inserts -----------------------------
-- The two live guest forms insert as anon with no org_id. These triggers
-- attach the tenant server-side so the rows land inside host-la with a
-- verifications row, and reject a client that tries to pick a foreign org.
CREATE OR REPLACE FUNCTION public.reservations_auto_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  IF new.org_id IS NOT NULL THEN
    -- a client may only file into an org it is staff of; service/in-DB callers pass
    IF auth.role() IN ('anon', 'authenticated') AND NOT public.has_org_role(new.org_id, 'staff') THEN
      RAISE EXCEPTION 'cannot assign a reservation to an organization you are not staff of' USING ERRCODE = '42501';
    END IF;
    RETURN new;
  END IF;
  -- ponytail: guest path hardwired to host-la (the only tenant with a public
  -- form in phase 1); phase 2 guest links carry their own org and skip this.
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'host-la';
  new.org_id := v_org;
  new.property_id := coalesce(
    (SELECT id FROM public.properties WHERE org_id = v_org AND slug = new.property_slug),
    (SELECT id FROM public.properties WHERE org_id = v_org AND slug = 'unassigned')
  );
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.reservations_create_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.verifications (org_id, reservation_id, status)
  VALUES (new.org_id, new.id, 'pending')
  ON CONFLICT (reservation_id) DO NOTHING;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.verification_documents_auto_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_vid uuid;
BEGIN
  IF new.reservation_id IS NOT NULL AND (new.org_id IS NULL OR new.verification_id IS NULL) THEN
    SELECT r.org_id, v.id INTO v_org, v_vid
    FROM public.reservations r
    LEFT JOIN public.verifications v ON v.reservation_id = r.id
    WHERE r.id = new.reservation_id;
    new.org_id := coalesce(new.org_id, v_org);
    new.verification_id := coalesce(new.verification_id, v_vid);
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.verification_documents_submit_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.verification_id IS NOT NULL THEN
    UPDATE public.verifications
    SET status = 'submitted', submitted_at = coalesce(submitted_at, now())
    WHERE id = new.verification_id AND status = 'pending';
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS trg_reservations_auto_tenant ON public.reservations;
CREATE TRIGGER trg_reservations_auto_tenant
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_auto_tenant();

DROP TRIGGER IF EXISTS trg_reservations_create_verification ON public.reservations;
CREATE TRIGGER trg_reservations_create_verification
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_create_verification();

DROP TRIGGER IF EXISTS trg_verification_documents_auto_tenant ON public.verification_documents;
CREATE TRIGGER trg_verification_documents_auto_tenant
  BEFORE INSERT ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.verification_documents_auto_tenant();

DROP TRIGGER IF EXISTS trg_verification_documents_submit_verification ON public.verification_documents;
CREATE TRIGGER trg_verification_documents_submit_verification
  AFTER INSERT ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.verification_documents_submit_verification();

-- --- 8.4 Legacy status sync -------------------------------------------
-- Both live admins mark review outcome by PATCHing reservations.status /
-- verification_documents.status to verified|rejected. Mirror that onto the
-- linked verification so the new table stays authoritative until Phase 2.
CREATE OR REPLACE FUNCTION public.sync_verification_from_legacy_status(
  p_res uuid, p_status text, p_by uuid, p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target text;
BEGIN
  v_target := CASE p_status WHEN 'verified' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE NULL END;
  IF v_target IS NULL THEN RETURN; END IF;
  UPDATE public.verifications
  SET status = v_target,
      reviewed_by = coalesce(p_by, reviewed_by),
      reviewed_at = coalesce(p_at, now()),
      decision_reason = coalesce(decision_reason, 'synced from legacy status'),
      updated_at = now()
  WHERE reservation_id = p_res
    AND status NOT IN ('approved', 'rejected', 'expired', 'deleted');
END; $$;

CREATE OR REPLACE FUNCTION public.verification_documents_sync_legacy_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status AND new.reservation_id IS NOT NULL THEN
    PERFORM public.sync_verification_from_legacy_status(new.reservation_id, new.status, new.reviewed_by, new.reviewed_at);
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.reservations_sync_legacy_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    PERFORM public.sync_verification_from_legacy_status(new.id, new.status, NULL, NULL);
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS trg_verification_documents_sync_legacy_status ON public.verification_documents;
CREATE TRIGGER trg_verification_documents_sync_legacy_status
  AFTER UPDATE OF status ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.verification_documents_sync_legacy_status();

DROP TRIGGER IF EXISTS trg_reservations_sync_legacy_status ON public.reservations;
CREATE TRIGGER trg_reservations_sync_legacy_status
  AFTER UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_sync_legacy_status();

-- --- 8.5 Last-owner protection ----------------------------------------
CREATE OR REPLACE FUNCTION public.organization_members_protect_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_remaining int;
BEGIN
  IF old.role <> 'owner' THEN
    RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
  END IF;
  IF tg_op = 'UPDATE' AND new.role = 'owner' THEN
    RETURN new;  -- still an owner, nothing lost
  END IF;
  SELECT count(*) INTO v_remaining
  FROM public.organization_members
  WHERE org_id = old.org_id AND role = 'owner' AND user_id <> old.user_id;
  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'cannot remove or demote the last owner of an organization' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE new END;
END; $$;

DROP TRIGGER IF EXISTS trg_organization_members_protect_last_owner ON public.organization_members;
CREATE TRIGGER trg_organization_members_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.organization_members_protect_last_owner();

-- --- 8.6 Cross-org referential integrity (composite FKs) --------------
-- A child row's org_id must match its parent's, so staff of org A cannot
-- attach a verification/document/consent to org B's reservation. Enforced
-- declaratively. MATCH SIMPLE: a NULL org_id/ref (legacy rows before the
-- backfill) skips the check, so this is safe to add before the backfill.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_org_id_id_key') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_org_id_id_key UNIQUE (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_org_id_id_key') THEN
    ALTER TABLE public.properties ADD CONSTRAINT properties_org_id_id_key UNIQUE (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_org_id_id_key') THEN
    ALTER TABLE public.verifications ADD CONSTRAINT verifications_org_id_id_key UNIQUE (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_templates_org_id_id_key') THEN
    ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_org_id_id_key UNIQUE (org_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_org_property_fkey') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_org_property_fkey
      FOREIGN KEY (org_id, property_id) REFERENCES public.properties (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_org_reservation_fkey') THEN
    ALTER TABLE public.verifications ADD CONSTRAINT verifications_org_reservation_fkey
      FOREIGN KEY (org_id, reservation_id) REFERENCES public.reservations (org_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guest_links_org_reservation_fkey') THEN
    ALTER TABLE public.guest_links ADD CONSTRAINT guest_links_org_reservation_fkey
      FOREIGN KEY (org_id, reservation_id) REFERENCES public.reservations (org_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verification_documents_org_verification_fkey') THEN
    ALTER TABLE public.verification_documents ADD CONSTRAINT verification_documents_org_verification_fkey
      FOREIGN KEY (org_id, verification_id) REFERENCES public.verifications (org_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consents_org_verification_fkey') THEN
    ALTER TABLE public.consents ADD CONSTRAINT consents_org_verification_fkey
      FOREIGN KEY (org_id, verification_id) REFERENCES public.verifications (org_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consents_org_template_fkey') THEN
    ALTER TABLE public.consents ADD CONSTRAINT consents_org_template_fkey
      FOREIGN KEY (org_id, template_id) REFERENCES public.document_templates (org_id, id);
  END IF;
END $$;

-- one signature document per verification (idempotency backstop for the
-- Phase 2 signature migration; harmless in Phase 1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_documents_signature
  ON public.verification_documents (verification_id) WHERE kind = 'signature';

-- --- 8.7 Tenant reads for signatures + document images ----------------
-- is_admin() now means platform admin, so tenant staff need their own read
-- path to the signature rows and storage objects the admin UI displays.
DROP POLICY IF EXISTS "org_select_digital_signatures" ON public.digital_signatures;
CREATE POLICY "org_select_digital_signatures"
  ON public.digital_signatures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = digital_signatures.reservation_id
      AND (public.has_org_role(r.org_id, 'viewer') OR public.is_platform_admin())
  ));

-- interim storage read for tenant members (Phase 2 replaces Supabase Storage
-- with R2). Path columns are indexed below so the per-object subquery is a
-- probe, not a seqscan.
CREATE INDEX IF NOT EXISTS idx_verification_documents_id_document_path ON public.verification_documents (id_document_path);
CREATE INDEX IF NOT EXISTS idx_verification_documents_credit_card_path ON public.verification_documents (credit_card_path);
CREATE INDEX IF NOT EXISTS idx_verification_documents_storage_path ON public.verification_documents (storage_path);

DROP POLICY IF EXISTS "org_select_documents_storage" ON storage.objects;
CREATE POLICY "org_select_documents_storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.verification_documents vd
      WHERE (vd.id_document_path = storage.objects.name
             OR vd.credit_card_path = storage.objects.name
             OR vd.storage_path = storage.objects.name)
        AND (public.has_org_role(vd.org_id, 'viewer') OR public.is_platform_admin())
    )
  );

-- --- 8.8 Guest INSERT policies require the post-trigger invariant ------
-- The BEFORE trigger (8.3) has already set org_id/property_id by the time
-- RLS WITH CHECK runs, so a guest can never smuggle in a foreign org_id
-- (the trigger rejects it) and the policy asserts the row is fully tenanted.
DROP POLICY IF EXISTS "guest_insert_reservation" ON public.reservations;
CREATE POLICY "guest_insert_reservation"
  ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (
    traveler_id IS NULL
    AND status = 'pending'
    AND check_out_date >= check_in_date
    AND total_amount > 0
    AND org_id IS NOT NULL
    AND property_id IS NOT NULL
  );

DROP POLICY IF EXISTS "guest_insert_verification_document" ON public.verification_documents;
CREATE POLICY "guest_insert_verification_document"
  ON public.verification_documents FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND reservation_id IS NOT NULL
    AND org_id IS NOT NULL
  );

-- --- 8.9 Grants hardening ---------------------------------------------
-- Supabase's default ACL grants EXECUTE to anon by name on every new public
-- function, so REVOKE ... FROM PUBLIC above was a no-op. No anon path in
-- this app calls a function directly (trigger functions are invoked by the
-- system regardless of EXECUTE), so revoke anon EXECUTE across the schema.
-- Revoke from PUBLIC as well as anon: functions default to PUBLIC EXECUTE,
-- which anon inherits, so revoking anon alone leaves it callable. Explicit
-- GRANTs to authenticated/service_role above are unaffected; trigger
-- functions keep firing (trigger invocation does not check EXECUTE).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- authenticated must not call the internal mutators directly.
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, uuid, text, text, uuid, jsonb, inet) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_verification_from_legacy_status(uuid, text, uuid, timestamptz) FROM authenticated;

-- service_role runs the edge functions in Phase 2; give it the action RPCs.
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_verification(uuid, text, text) TO service_role;

-- anon has zero permissive policies on the new tables; drop its table grants too.
REVOKE ALL ON TABLE
  public.organizations, public.organization_members, public.organization_invites,
  public.platform_admins, public.properties, public.verifications, public.audit_events,
  public.guest_links, public.document_templates, public.consents
FROM anon;

-- organizations: tenants may edit their name/retention/settings, never their
-- own plan/billing/slug. Column-level UPDATE; RLS still scopes to the row.
REVOKE UPDATE ON public.organizations FROM authenticated;
GRANT UPDATE (name, retention_days_images, retention_days_signature, retention_days_pii, retention_days_unsubmitted, settings)
  ON public.organizations TO authenticated;
