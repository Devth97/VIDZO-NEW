import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}

const dbMessages: Record<string, [number, string]> = {
  insufficient_credits: [402, 'Insufficient credits. Add credits to continue.'],
  operation_conflict: [409, 'This operation was already recorded with different details.'],
  no_reservation: [409, 'No matching credit reservation.'],
  invalid_amount: [400, 'Invalid credit amount.'],
  wallet_not_found: [404, 'Wallet not found.'],
};

/** Maps an exception to a safe JSON response. Internal details are logged, never returned. */
export function toResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: 'Some details are invalid. Check the form and try again.', code: 'invalid_input' }, { status: 400 });
  const message = e instanceof Error ? e.message : '';
  for (const [key, [status, text]] of Object.entries(dbMessages)) if (message.includes(key)) return NextResponse.json({ error: text, code: key }, { status });
  if (e instanceof Error && e.name === 'DomainError') return NextResponse.json({ error: e.message, code: 'rejected' }, { status: 422 });
  console.error('[vidzo] unhandled error', e);
  return NextResponse.json({ error: 'Something went wrong on our side. Your work is saved; please try again.', code: 'internal' }, { status: 500 });
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => { try { return await fn(...args); } catch (e) { return toResponse(e); } };
}

/** Wraps domain rule violations (plain Error from pure functions) as user-facing 422 errors. */
export function domain<T>(fn: () => T): T {
  try { return fn(); } catch (e) {
    if (e instanceof HttpError || e instanceof ZodError) throw e;
    throw new HttpError(422, e instanceof Error ? e.message : 'That change is not allowed.', 'rejected');
  }
}
