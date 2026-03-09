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

  const MAX_PARTICIPANTS = 20;
  const MAX_BLOCKS_PER_PARTICIPANT = 1000;

  if (Object.keys(session.participants).length >= MAX_PARTICIPANTS) {
    return NextResponse.json({ error: 'Session is full' }, { status: 409 });
  }

  if (blocks.length > MAX_BLOCKS_PER_PARTICIPANT) {
    return NextResponse.json({ error: 'Too many blocks' }, { status: 400 });
  }

  // Strip anything beyond BusyBlock fields for safety
  const safeBlocks: BusyBlock[] = blocks.map(b => ({
    start: String(b.start),
    end: String(b.end),
    busy: Boolean(b.busy),
    allDay: Boolean(b.allDay),
  }));

  const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;
  for (const b of safeBlocks) {
    if (!ISO_RE.test(b.start) || !ISO_RE.test(b.end)) {
      return NextResponse.json({ error: 'Invalid block date format' }, { status: 400 });
    }
  }

  const participantId = generateToken(12);
  const updated: Session = {
    ...session,
    participants: { ...session.participants, [participantId]: safeBlocks },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ participantId }, { status: 201 });
}
