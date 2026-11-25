-- VIDZO initial schema. Applied by the Supabase CLI in live environments and by the local test backend
-- (PGlite) after supabase/local/00_auth_stub.sql. The application server connects as the table owner and
-- enforces workspace authorization in code; RLS below is defence in depth for any direct client access.

-- ------------------------------------------------------------------------------------------------
-- Identity and tenancy
-- ------------------------------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) <= 320),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

-- ------------------------------------------------------------------------------------------------
-- Projects and immutable assets
-- ------------------------------------------------------------------------------------------------
create table public.projects (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  doc jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index projects_workspace_idx on public.projects(workspace_id, updated_at desc);

create table public.assets (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('reference', 'product', 'logo', 'frame', 'character', 'clip', 'export')),
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (mime in ('video/mp4', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/json')),
  bytes bigint not null check (bytes > 0 and bytes <= 100000000),
  object_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  placeholder boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  scene_id text, candidate_id text, dep_hash text, version integer, job_id uuid,
  reject_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint assets_key_scope check (object_key like workspace_id::text || '/' || project_id::text || '/%')
);
create index assets_project_idx on public.assets(project_id, created_at);

-- Originals and outputs are immutable once written: only the verification outcome may change, once.
create function public.assets_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'verified' then raise exception 'verified assets are immutable'; end if;
    return old;
  end if;
  if new.id <> old.id or new.workspace_id <> old.workspace_id or new.project_id <> old.project_id or new.kind <> old.kind
     or new.mime <> old.mime or new.bytes <> old.bytes or new.object_key <> old.object_key or new.name <> old.name
     or new.placeholder <> old.placeholder or new.dep_hash is distinct from old.dep_hash or new.scene_id is distinct from old.scene_id
     or new.candidate_id is distinct from old.candidate_id or new.version is distinct from old.version then
    raise exception 'assets are immutable';
  end if;
  if old.status <> 'pending' and new.status <> old.status then raise exception 'asset verification is final'; end if;
  return new;
end $$;
create trigger assets_immutable before update or delete on public.assets for each row execute function public.assets_immutable();

-- ------------------------------------------------------------------------------------------------
-- Quotes, jobs and provider attempts
-- ------------------------------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('professional', 'premium')),
  scope text not null check (scope in ('frame', 'characters', 'character', 'video', 'scene', 'export', 'analysis')),
  target_id text,
  credits integer not null check (credits >= 0),
  seconds integer not null default 0,
  fingerprint text not null,
  pricing_version text not null,
  tasks jsonb not null,
  model text not null, native_resolution text not null, retry_policy text not null,
  illustrative boolean not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid unique references public.quotes(id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  kind text not null check (kind in ('analysis', 'frame', 'characters', 'character', 'video', 'scene', 'export')),
  status text not null check (status in ('queued', 'submitted', 'running', 'review', 'succeeded', 'failed', 'canceled')),
  stage text not null default 'Queued',
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  credits_settled integer not null default 0 check (credits_settled >= 0),
  error text,
  needs_attention boolean not null default false,
  lease_until timestamptz,
  input jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, idempotency_key)
);
create index jobs_active_idx on public.jobs(user_id) where status in ('queued', 'submitted', 'running');
create index jobs_project_idx on public.jobs(project_id, created_at desc);

create function public.jobs_input_immutable() returns trigger language plpgsql as $$
begin
  if new.input <> old.input or new.quote_id is distinct from old.quote_id or new.credits_reserved <> old.credits_reserved then
    raise exception 'job inputs are immutable';
  end if;
  return new;
end $$;
create trigger jobs_input_immutable before update on public.jobs for each row execute function public.jobs_input_immutable();

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id text not null,
  kind text not null,
  scene_id text, candidate_id text,
  provider text not null, endpoint text not null,
  idempotency_key text not null unique,
  request_id text,
  status text not null check (status in ('pending', 'submitting', 'submitted', 'running', 'succeeded', 'failed', 'unknown')),
  tries integer not null default 0,
  next_at timestamptz not null default now(),
  error text,
  output_asset_id uuid references public.assets(id),
  estimated_cost_paise integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, task_id)
);

-- ------------------------------------------------------------------------------------------------
-- Credits: wallet balances + append-only ledger, mutated only through the functions below
-- ------------------------------------------------------------------------------------------------
create table public.wallets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  available bigint not null default 0 check (available >= 0),
  held bigint not null default 0 check (held >= 0),
  spent bigint not null default 0 check (spent >= 0),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  operation_id text not null,
  kind text not null check (kind in ('reserve', 'settle', 'release', 'purchase', 'adjust')),
  amount bigint not null check (amount > 0),
  job_id uuid, payment_id uuid, note text,
  created_at timestamptz not null default now(),
  unique (operation_id, kind)
);
create index ledger_workspace_idx on public.ledger_entries(workspace_id, id desc);

create function public.ledger_append_only() returns trigger language plpgsql as $$
begin raise exception 'ledger entries are append-only'; end $$;
create trigger ledger_append_only before update or delete on public.ledger_entries for each row execute function public.ledger_append_only();

create table public.payments (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  order_id text not null,
  pack_id text not null,
  credits integer not null check (credits > 0),
  amount_paise integer not null check (amount_paise > 0),
  currency text not null check (currency = 'INR'),
  status text not null check (status in ('created', 'captured', 'failed')),
  provider_payment_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  unique (provider, order_id)
);

create table public.webhook_events (
  provider text not null,
  event_id text not null,
  type text not null,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

create function public.wallet_reserve(p_workspace uuid, p_operation text, p_amount bigint, p_job uuid)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare w public.wallets; prior public.ledger_entries;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  select * into w from public.wallets where workspace_id = p_workspace for update;
  if not found then raise exception 'wallet_not_found'; end if;
  select * into prior from public.ledger_entries where operation_id = p_operation and kind = 'reserve';
  if found then
    if prior.amount <> p_amount or prior.workspace_id <> p_workspace then raise exception 'operation_conflict'; end if;
    return w;
  end if;
  if w.available < p_amount then raise exception 'insufficient_credits'; end if;
  update public.wallets set available = available - p_amount, held = held + p_amount, updated_at = now()
    where workspace_id = p_workspace returning * into w;
  insert into public.ledger_entries(workspace_id, operation_id, kind, amount, job_id) values (p_workspace, p_operation, 'reserve', p_amount, p_job);
  return w;
end $$;

-- Settles p_settle of a reservation and releases the remainder. Idempotent per operation.
create function public.wallet_finalize(p_workspace uuid, p_operation text, p_settle bigint)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare w public.wallets; r public.ledger_entries; settled bigint; finished integer;
begin
  select * into w from public.wallets where workspace_id = p_workspace for update;
  if not found then raise exception 'wallet_not_found'; end if;
  select * into r from public.ledger_entries where operation_id = p_operation and kind = 'reserve' and workspace_id = p_workspace;
  if not found then raise exception 'no_reservation'; end if;
  select count(*), coalesce(sum(amount) filter (where kind = 'settle'), 0) into finished, settled
    from public.ledger_entries where operation_id = p_operation and kind in ('settle', 'release');
  if finished > 0 then
    if settled <> p_settle then raise exception 'operation_conflict'; end if;
    return w;
  end if;
  if p_settle is null or p_settle < 0 or p_settle > r.amount then raise exception 'invalid_amount'; end if;
  update public.wallets set held = held - r.amount, spent = spent + p_settle, available = available + (r.amount - p_settle), updated_at = now()
    where workspace_id = p_workspace returning * into w;
  if p_settle > 0 then insert into public.ledger_entries(workspace_id, operation_id, kind, amount, job_id) values (p_workspace, p_operation, 'settle', p_settle, r.job_id); end if;
  if r.amount - p_settle > 0 then insert into public.ledger_entries(workspace_id, operation_id, kind, amount, job_id) values (p_workspace, p_operation, 'release', r.amount - p_settle, r.job_id); end if;
  return w;
end $$;

-- Grants credits only for a verified capture whose amount and currency match the server-created order.
create function public.payment_capture(p_provider text, p_order_id text, p_payment_id text, p_amount bigint, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  select * into pay from public.payments where provider = p_provider and order_id = p_order_id for update;
  if not found then return 'unknown_order'; end if;
  if pay.status = 'captured' then return 'duplicate'; end if;
  if p_amount <> pay.amount_paise or p_currency <> pay.currency then
    update public.payments set failure_reason = 'amount_or_currency_mismatch' where id = pay.id;
    return 'mismatch';
  end if;
  update public.payments set status = 'captured', provider_payment_id = p_payment_id, captured_at = now(), failure_reason = null where id = pay.id;
  perform 1 from public.wallets where workspace_id = pay.workspace_id for update;
  update public.wallets set available = available + pay.credits, updated_at = now() where workspace_id = pay.workspace_id;
  insert into public.ledger_entries(workspace_id, operation_id, kind, amount, payment_id, note)
    values (pay.workspace_id, 'payment:' || pay.id::text, 'purchase', pay.credits, pay.id, pay.pack_id);
  return 'captured';
end $$;

revoke all on function public.wallet_reserve(uuid, text, bigint, uuid) from public;
revoke all on function public.wallet_finalize(uuid, text, bigint) from public;
revoke all on function public.payment_capture(text, text, text, bigint, text) from public;

-- ------------------------------------------------------------------------------------------------
-- Review, support and operations
-- ------------------------------------------------------------------------------------------------
create table public.qa_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  export_asset_id uuid not null references public.assets(id),
  decision text not null check (decision in ('pending', 'approved', 'rejected')),
  note text check (char_length(note) <= 2000),
  reviewer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index qa_reviews_project_idx on public.qa_reviews(project_id, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 150),
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.admin_settings(key, value) values
  ('limits', '{"dailySpendCapInr": 5000, "perUserConcurrency": 2, "generationPaused": false, "circuitBreakers": {}}'::jsonb);

-- ------------------------------------------------------------------------------------------------
-- Row level security (read-only for members; all writes go through the server)
-- ------------------------------------------------------------------------------------------------
create function public.is_member(ws uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where workspace_id = ws and user_id = auth.uid())
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.attempts enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.qa_reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_settings enable row level security;

create policy profiles_self on public.profiles for select to authenticated using (user_id = auth.uid());
create policy workspaces_member on public.workspaces for select to authenticated using (public.is_member(id));
create policy memberships_self on public.memberships for select to authenticated using (user_id = auth.uid());
create policy projects_member on public.projects for select to authenticated using (public.is_member(workspace_id));
create policy assets_member on public.assets for select to authenticated using (public.is_member(workspace_id));
create policy quotes_member on public.quotes for select to authenticated using (public.is_member(workspace_id));
create policy jobs_member on public.jobs for select to authenticated using (public.is_member(workspace_id));
create policy wallets_member on public.wallets for select to authenticated using (public.is_member(workspace_id));
create policy ledger_member on public.ledger_entries for select to authenticated using (public.is_member(workspace_id));
create policy payments_member on public.payments for select to authenticated using (public.is_member(workspace_id));
create policy qa_member on public.qa_reviews for select to authenticated using (public.is_member(workspace_id));
create policy support_member on public.support_tickets for select to authenticated using (public.is_member(workspace_id));
-- attempts, webhook_events and admin_settings have no client policies: server and admins only.
