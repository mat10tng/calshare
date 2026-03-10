import { NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  const body = await req.json();
  const quorum = Number(body.quorum ?? 1);
  const lookAheadDays = Number(body.lookAheadDays ?? 14);
  const expiryDays = Number(body.expiryDays ?? 7);
  const type = body.type === 'personal' ? 'personal' : 'group';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : undefined;

  if (!Number.isFinite(quorum) || quorum < 1 || !Number.isFinite(lookAheadDays) || lookAheadDays < 1 || lookAheadDays > 90) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const result = await createSession({ quorum, lookAheadDays, expiryDays, type, name });
  return NextResponse.json(result, { status: 201 });
}
