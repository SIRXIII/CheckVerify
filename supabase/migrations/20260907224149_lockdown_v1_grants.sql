-- Tighten EXECUTE on the two SECURITY DEFINER helpers added by lockdown_v1 (advisor 0028/0029).
-- Applied live 2026-09-07 via Supabase MCP.
-- block_admin_self_grant() is a trigger function: nobody needs to call it directly.
REVOKE ALL ON FUNCTION public.block_admin_self_grant() FROM PUBLIC, anon, authenticated;
-- is_admin() is only referenced by policies that apply TO authenticated; anon never needs it.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
