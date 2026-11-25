import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, requireContext, type Ctx } from './auth';
import { mode } from './config';
import { HttpError, toResponse } from './errors';

type Params = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: Ctx, params: Record<string, string>) => Promise<unknown>;

/** Mutations must come from our own origin (defence in depth on top of SameSite=Lax cookies). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients; still need a valid session cookie
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Cross-site request blocked.', 'csrf');
}

export async function body(req: NextRequest, max = 200_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, 'Request too large.', 'too_large');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'Invalid JSON.', 'invalid_json'); }
}

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

function wrap(level: 'user' | 'admin', fn: Handler) {
  return async (req: NextRequest, p: Params) => {
    try {
      if (mode() === 'demo') throw new HttpError(404, 'Server APIs are disabled in demo mode.', 'demo_mode');
      assertSameOrigin(req);
      const ctx = level === 'admin' ? await requireAdmin() : await requireContext();
      const result = await fn(req, ctx, p?.params ? await p.params : {});
      return result instanceof Response ? result : json(result ?? { ok: true });
    } catch (e) { return toResponse(e); }
  };
}
export const userRoute = (fn: Handler) => wrap('user', fn);
export const adminRoute = (fn: Handler) => wrap('admin', fn);

export function publicRoute(fn: (req: NextRequest, params: Record<string, string>) => Promise<unknown>) {
  return async (req: NextRequest, p: Params) => {
    try { assertSameOrigin(req); const r = await fn(req, p?.params ? await p.params : {}); return r instanceof Response ? r : json(r ?? { ok: true }); } catch (e) { return toResponse(e); }
  };
}
