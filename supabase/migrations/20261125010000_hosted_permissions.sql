-- Hosted Supabase explicitly grants function execution to API roles by default.
-- Revoking PUBLIC alone does not remove those separate grants. Credit mutations
-- are server-only and must never be callable through the browser's REST API.
revoke all on function public.wallet_reserve(uuid, text, bigint, uuid) from public, anon, authenticated;
revoke all on function public.wallet_finalize(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.payment_capture(text, text, text, bigint, text) from public, anon, authenticated;

revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

alter function public.assets_immutable() set search_path = '';
alter function public.jobs_input_immutable() set search_path = '';
alter function public.ledger_append_only() set search_path = '';

alter policy profiles_self on public.profiles using (user_id = (select auth.uid()));
alter policy memberships_self on public.memberships using (user_id = (select auth.uid()));
