import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import type { BusyBlock } from '@/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (\!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const organizerBlocks = session.participants['__organizer__'] ?? [];
  return NextResponse.json({
    sessionId: session.sessionId,
    lookAheadDays: session.lookAheadDays,
    blocks: organizerBlocks,
  } satisfies { sessionId: string; lookAheadDays: number; blocks: BusyBlock[] });
}
