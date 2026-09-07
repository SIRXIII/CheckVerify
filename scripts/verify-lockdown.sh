#!/usr/bin/env bash
# Verifies the RLS lockdown (supabase/migrations/20260907000100_lockdown_v1.sql)
# actually took effect, by hitting PostgREST/Storage as the anon role and
# checking the responses. Does not touch any database credentials beyond
# the anon key, and never echoes the values it loads from .env.
#
# Usage: scripts/verify-lockdown.sh [storage-object-path-to-probe]
#   storage-object-path-to-probe defaults to id-documents/PLACEHOLDER.jpg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: .env not found at $ENV_FILE" >&2
  exit 1
fi

# Load only the two vars we need. Never echo their values.
SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' "$ENV_FILE" | tail -n1 | cut -d '=' -f2- | tr -d '"'"'"'\r')"
SUPABASE_ANON_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$ENV_FILE" | tail -n1 | cut -d '=' -f2- | tr -d '"'"'"'\r')"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "FAIL: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env" >&2
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL%/}"

FAIL_COUNT=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# (a) (b) (c): anon SELECT on every public table must return no rows.
check_empty_select() {
  local table="$1"
  local body
  body="$(curl -s "$SUPABASE_URL/rest/v1/$table?select=id&limit=1" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY")"
  if [ "$body" = "[]" ]; then
    pass "anon select $table returns []"
  else
    fail "anon select $table returned: $body"
  fi
}

echo "== anon SELECT checks =="
check_empty_select "reservations"
check_empty_select "verification_documents"
check_empty_select "digital_signatures"
check_empty_select "user_profiles"

# (d): the documents bucket is private now; the public storage URL must
# not serve any object, regardless of whether the object exists.
echo "== storage public object access =="
STORAGE_PATH="${1:-id-documents/PLACEHOLDER.jpg}"
STORAGE_STATUS="$(curl -s -o /dev/null -w "%{http_code}" \
  "$SUPABASE_URL/storage/v1/object/public/documents/$STORAGE_PATH")"
if [ "$STORAGE_STATUS" = "200" ]; then
  fail "GET storage/v1/object/public/documents/$STORAGE_PATH returned 200 (bucket should be private)"
else
  pass "GET storage/v1/object/public/documents/$STORAGE_PATH returned $STORAGE_STATUS (not 200)"
fi

# (e): anon insert into reservations with a non-pending status must be
# rejected by guest_insert_reservation's WITH CHECK.
echo "== anon INSERT policy checks =="
RES_STATUS="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/reservations" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "verified",
    "confirmation_number": "verify-lockdown-'"$(date +%s)"'",
    "guest_name": "Lockdown Verify",
    "check_in_date": "2030-01-01",
    "check_out_date": "2030-01-02",
    "total_amount": 100,
    "booking_platform": "verify-script"
  }')"
if [[ "$RES_STATUS" =~ ^4 ]]; then
  pass "anon insert reservations with status=verified rejected ($RES_STATUS)"
else
  fail "anon insert reservations with status=verified returned $RES_STATUS (expected 4xx)"
fi

# (f): anon insert into user_profiles (any row, admin or not) must be
# rejected — there is no anon INSERT policy on user_profiles at all.
PROFILE_STATUS="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/user_profiles" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "00000000-0000-0000-0000-000000000000",
    "email": "verify-lockdown@example.com",
    "user_type": "admin"
  }')"
if [[ "$PROFILE_STATUS" =~ ^4 ]]; then
  pass "anon insert user_profiles with user_type=admin rejected ($PROFILE_STATUS)"
else
  fail "anon insert user_profiles with user_type=admin returned $PROFILE_STATUS (expected 4xx)"
fi

echo
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "$FAIL_COUNT CHECK(S) FAILED"
  exit 1
fi
