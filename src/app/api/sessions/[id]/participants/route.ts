import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getSession, generateToken } from '@/lib/session';
import type { BusyBlock, Session } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { participantToken, blocks } = body as { participantToken: string; blocks: BusyBlock[] };

  if (!participantToken || !Array.isArray(blocks)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // participantToken must equal sessionId (included in join link)
  if (participantToken !== id) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  // Strip anything beyond BusyBlock fields for safety
  const safeBlocks: BusyBlock[] = blocks.map(b => ({
    start: String(b.start),
    end: String(b.end),
    busy: Boolean(b.busy),
    allDay: Boolean(b.allDay),
  }));

  const participantId = generateToken(12);
  const updated: Session = {
    ...session,
    participants: { ...session.participants, [participantId]: safeBlocks },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ participantId }, { status: 201 });
}
