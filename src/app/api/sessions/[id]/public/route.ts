import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import type { BusyBlock } from '@/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (session == null) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const raw = session.participants['__organizer__'];
  const organizerBlocks: BusyBlock[] = Array.isArray(raw) ? raw : [];
  return NextResponse.json({
    sessionId: session.sessionId,
    lookAheadDays: session.lookAheadDays,
    blocks: organizerBlocks,
  } satisfies { sessionId: string; lookAheadDays: number; blocks: BusyBlock[] });
}
