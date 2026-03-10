import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ sessionId: session.sessionId, lookAheadDays: session.lookAheadDays, name: session.name ?? null });
}
