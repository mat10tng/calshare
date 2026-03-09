import { NextResponse } from 'next/server';
import { kv, getSession, generateToken, verifyOrganizerToken, ISO_RE, sanitiseBlocks } from '@/lib/session';
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

  const safeBlocks = sanitiseBlocks(blocks);
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

// Organizer can upsert their own blocks under the fixed '__organizer__' key
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyOrganizerToken(id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { blocks } = body as { blocks: BusyBlock[] };
  if (!Array.isArray(blocks)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
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
    participants: { ...session.participants, __organizer__: safeBlocks },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ ok: true });
}
