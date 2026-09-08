-- Trigger functions and the legacy-sync helper are never called directly by a
-- client (a RETURNS trigger function errors if invoked via RPC; the sync helper
-- is service/in-DB only). Revoke authenticated EXECUTE so they leave the exposed
-- RPC surface (advisor 0029). Trigger invocation does not check EXECUTE.
REVOKE EXECUTE ON FUNCTION public.reservations_auto_tenant() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reservations_create_verification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verification_documents_auto_tenant() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verification_documents_submit_verification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verification_documents_sync_legacy_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reservations_sync_legacy_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.organization_members_protect_last_owner() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verifications_enforce_transition() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verifications_log_transition() FROM authenticated;
