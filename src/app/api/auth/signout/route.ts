import { publicRoute } from '@/lib/server/http';
import { signOut } from '@/lib/server/auth';

export const POST = publicRoute(async () => { await signOut(); return { ok: true }; });
