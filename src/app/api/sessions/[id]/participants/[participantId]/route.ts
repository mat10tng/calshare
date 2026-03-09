import { NextResponse } from 'next/server';
import { kv, getSession } from '@/lib/session';
import type { BusyBlock, Session } from '@/types';

const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

function sanitiseBlocks(blocks: BusyBlock[]): BusyBlock[] {
  return blocks.map(b => ({
    start: String(b.start),
    end: String(b.end),
    busy: Boolean(b.busy),
    allDay: Boolean(b.allDay),
    ...(b.title ? { title: String(b.title).slice(0, 200) } : {}),
  }));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const { id, participantId } = await params;

  const body = await req.json();
  const { participantToken, blocks } = body as { participantToken: string; blocks: BusyBlock[] };

  if (!participantToken || !Array.isArray(blocks)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Auth: participantToken must match participantId
  if (participantToken !== participantId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Participant slot must already exist
  if (!(participantId in session.participants)) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (blocks.length > 1000) {
    return NextResponse.json({ error: 'Too many blocks' }, { status: 400 });
  }

  const safeBlocks = sanitiseBlocks(blocks);
  for (const b of safeBlocks) {
    if (!ISO_RE.test(b.start) || !ISO_RE.test(b.end)) {
      return NextResponse.json({ error: 'Invalid block date format' }, { status: 400 });
    }
  }

  const updated: Session = {
    ...session,
    participants: { ...session.participants, [participantId]: safeBlocks },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ ok: true });
}
