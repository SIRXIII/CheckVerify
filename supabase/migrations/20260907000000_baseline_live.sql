/*
  # Baseline migration history to match live schema

  Captured 2026-09-07 from project nwctkkdmbczpyhwqqonc (Check-In Verify).

  Why: the live database has drifted from what `supabase/migrations/*.sql`
  would produce if replayed from scratch. The drift was introduced through
  ad hoc edits made in the Supabase dashboard (Table Editor / SQL Editor)
  rather than through migration files, so a fresh `db reset` / `db push`
  would not reproduce the live schema.

  This migration reconciles the two directions:
    - Columns that exist live but were never captured in a migration
      (`reservations.guest_email`, `reservations.property_slug`,
      `verification_documents.updated_at`) are added here so a replayed
      migration history matches live.
    - A foreign key that the first migration created
      (`reservations.traveler_id -> user_profiles.id`) but that does not
      exist live (it was dropped via the dashboard at some point) is
      dropped here so the two stay in sync.
    - Nine dead columns on `verification_documents` that only exist live
      as dashboard drift (all-NULL or all-empty-string on every row, never
      read or written by the app) are dropped.

  From now on: all schema changes go through migration files applied via
  the Supabase MCP / CLI. No more dashboard schema edits.

  Idempotent: safe to run against a database that already matches live,
  and safe to run against a database built fresh from the earlier
  migrations in this repo.
*/

-- reservations: add columns that exist live but were never migrated
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS property_slug text;

-- reservations: live has no FK on traveler_id; the repo's first migration
-- created one (reservations_traveler_id_fkey). Drop it to match live.
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_traveler_id_fkey;

-- verification_documents: add updated_at that exists live (no trigger
-- attached to it live; left as-is here, matching live behavior)
ALTER TABLE public.verification_documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- verification_documents: drop nine dead columns (dashboard drift, all
-- rows NULL or '', never referenced by the app)
ALTER TABLE public.verification_documents
  DROP COLUMN IF EXISTS id_document_url,
  DROP COLUMN IF EXISTS credit_card_url,
  DROP COLUMN IF EXISTS created_card_path,
  DROP COLUMN IF EXISTS selfie_path,
  DROP COLUMN IF EXISTS id_back_path,
  DROP COLUMN IF EXISTS id_front_path,
  DROP COLUMN IF EXISTS card_back_path,
  DROP COLUMN IF EXISTS signature_path,
  DROP COLUMN IF EXISTS card_front_path;
