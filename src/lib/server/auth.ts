import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { adminEmails, live, localSecret, mode } from './config';
import { getDb, type Queryable } from './db';
import { HttpError } from './errors';

export type SessionUser = { id: string; email: string };
export type Ctx = { userId: string; email: string; workspaceId: string; isAdmin: boolean };

const LOCAL_COOKIE = 'vidzo_local_session';
const SESSION_DAYS = 7;

export const safeNext = (next: unknown) => (typeof next === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : '/projects');
export const normalizeEmail = (email: unknown) => {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (e.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Enter a valid email address.', 'invalid_email');
  return e;
};

/** The local test backend serves loopback only; it must never be exposed as a hosted service. */
export async function assertLoopback() {
  if (mode() !== 'local') return;
  const host = ((await headers()).get('host') ?? '').toLowerCase().replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) throw new HttpError(403, 'The local test backend only accepts loopback requests.', 'not_loopback');
}

// ---------------------------------------------------------------------------------------------
// Live: Supabase Auth via @supabase/ssr cookies. getUser() verifies the token with Supabase.
// ---------------------------------------------------------------------------------------------
export async function supabaseServer() {
  const url = live.supabaseUrl(), key = live.supabaseKey();
  if (!url || !key) throw new HttpError(503, 'Sign-in is not configured yet.', 'not_configured');
  const { createServerClient } = await import('@supabase/ssr');
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ } },
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Local: hashed single-use link tokens; stateless HMAC session cookie.
// ---------------------------------------------------------------------------------------------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
function signSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', localSecret()).update('session:' + payload).digest('base64url');
}
function readSession(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', localSecret()).update('session:' + payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionUser & { exp: number };
  return s.exp > Date.now() ? { id: s.id, email: s.email } : null;
}

export async function createLocalSignInLink(email: string, next: string) {
  const token = randomBytes(32).toString('base64url');
  const db = await getDb();
  await db.query('insert into public.local_auth_tokens(token_hash, email, next_path, expires_at) values ($1, $2, $3, now() + interval \'15 minutes\')', [sha256(token), email, next]);
  return '/api/auth/local/verify?token=' + token;
}

export async function consumeLocalSignInLink(token: string): Promise<string> {
  const db = await getDb();
  const rows = await db.query<{ email: string; next_path: string }>('update public.local_auth_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email, next_path', [sha256(token)]);
  if (!rows[0]) throw new HttpError(400, 'This sign-in link is invalid, used or expired. Request a new one.', 'invalid_link');
  const [user] = await db.query<{ id: string; email: string }>('insert into auth.users(email) values ($1) on conflict (email) do update set email = excluded.email returning id, email', [rows[0].email]);
  (await cookies()).set(LOCAL_COOKIE, signSession(user), { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: SESSION_DAYS * 86_400 });
  return rows[0].next_path;
}

export async function signOut() {
  if (mode() === 'local') (await cookies()).delete(LOCAL_COOKIE);
  else if (mode() === 'live') await (await supabaseServer()).auth.signOut();
}

export async function sessionUser(): Promise<SessionUser | null> {
  const m = mode();
  if (m === 'local') { await assertLoopback(); return readSession((await cookies()).get(LOCAL_COOKIE)?.value); }
  if (m === 'live') {
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user?.email ? { id: data.user.id, email: data.user.email.toLowerCase() } : null;
  }
  return null;
}

/** Creates the profile, a private workspace and an empty wallet on first sign-in. New wallets start at zero. */
export async function ensureWorkspace(q: Queryable, user: SessionUser): Promise<Ctx> {
  const admin = adminEmails().includes(user.email);
  // Serialize first sign-in per user so concurrent requests cannot create two workspaces.
  await q.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
  await q.query('insert into public.profiles(user_id, email, is_admin) values ($1, $2, $3) on conflict (user_id) do update set email = excluded.email, is_admin = public.profiles.is_admin or excluded.is_admin', [user.id, user.email, admin]);
  let [m] = await q.query<{ workspace_id: string; is_admin: boolean }>('select m.workspace_id, p.is_admin from public.memberships m join public.profiles p on p.user_id = m.user_id where m.user_id = $1 order by m.created_at limit 1', [user.id]);
  if (!m) {
    const [ws] = await q.query<{ id: string }>('insert into public.workspaces(name) values ($1) returning id', ['Your workspace']);
    await q.query('insert into public.memberships(workspace_id, user_id, role) values ($1, $2, \'owner\')', [ws.id, user.id]);
    await q.query('insert into public.wallets(workspace_id) values ($1)', [ws.id]);
    m = { workspace_id: ws.id, is_admin: admin };
  }
  return { userId: user.id, email: user.email, workspaceId: m.workspace_id, isAdmin: Boolean(m.is_admin) };
}

export async function requireContext(): Promise<Ctx> {
  const user = await sessionUser();
  if (!user) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  const db = await getDb();
  return db.tx(q => ensureWorkspace(q, user));
}

export async function requireAdmin(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.isAdmin) throw new HttpError(403, 'Admin access required.', 'forbidden');
  return ctx;
}
