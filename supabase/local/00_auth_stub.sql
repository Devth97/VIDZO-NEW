-- LOCAL TEST BACKEND ONLY. Never apply to a Supabase project: Supabase already provides the auth schema,
-- auth.uid() and these roles. This stub lets PGlite run the same migration and RLS policies offline.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique not null, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant select on tables to anon, authenticated;

-- Single-use, hashed sign-in tokens for the local email sign-in flow.
create table if not exists public.local_auth_tokens (
  token_hash text primary key,
  email text not null,
  next_path text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table public.local_auth_tokens enable row level security;
