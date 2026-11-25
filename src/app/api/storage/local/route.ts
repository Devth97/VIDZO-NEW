import { NextResponse, type NextRequest } from 'next/server';
import { assertLoopback } from '@/lib/server/auth';
import { mode } from '@/lib/server/config';
import { toResponse, HttpError } from '@/lib/server/errors';
import { getStorage, readLocalObject, verifyLocalGrant } from '@/lib/server/storage';

/** LOCAL TEST BACKEND ONLY: stands in for signed R2 URLs. Objects are write-once. */
const guard = async () => { if (mode() !== 'local') throw new HttpError(404, 'Not found.'); await assertLoopback(); };

export async function GET(req: NextRequest) {
  try {
    await guard();
    const grant = verifyLocalGrant(new URL(req.url).searchParams.get('token') ?? '', 'GET');
    const data = await readLocalObject(grant.key).catch(() => { throw new HttpError(404, 'Not found.'); });
    return new NextResponse(new Uint8Array(data), { headers: {
      'Content-Type': grant.mime ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'self'; sandbox",
      'Content-Disposition': grant.download ? `attachment; filename="${grant.download.replace(/[^\w.-]/g, '_')}"` : 'inline',
    } });
  } catch (e) { return toResponse(e); }
}

export async function PUT(req: NextRequest) {
  try {
    await guard();
    const grant = verifyLocalGrant(new URL(req.url).searchParams.get('token') ?? '', 'PUT');
    if (req.headers.get('content-type') !== grant.mime) throw new HttpError(400, 'Content type does not match the signed upload.');
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (grant.bytes && declared > grant.bytes) throw new HttpError(413, 'Upload larger than declared.');
    const buf = new Uint8Array(await req.arrayBuffer());
    if (grant.bytes && buf.length > grant.bytes) throw new HttpError(413, 'Upload larger than declared.');
    try { await (await getStorage()).write(grant.key, buf, grant.mime!); } catch { throw new HttpError(409, 'This upload link was already used.'); }
    return new NextResponse(null, { status: 200 });
  } catch (e) { return toResponse(e); }
}
