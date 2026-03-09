import { NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  const body = await req.json();
  const quorum = Number(body.quorum ?? 1);
  const lookAheadDays = Number(body.lookAheadDays ?? 14);
  const expiryDays = Number(body.expiryDays ?? 7);

  if (quorum < 1 || lookAheadDays < 1 || lookAheadDays > 90) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const result = await createSession({ quorum, lookAheadDays, expiryDays });
  return NextResponse.json(result, { status: 201 });
}
