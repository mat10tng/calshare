import { NextResponse } from 'next/server';
import { kv, getSession, generateToken, verifyOrganizerToken, ISO_RE, sanitiseBlocks } from '@/lib/session';
import type { BusyBlock, Session } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { participantToken, personalSessionId } = body as {
    participantToken: string;
    personalSessionId: string;
  };

  if (!participantToken || !personalSessionId) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (participantToken !== id) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  // Verify personal session exists
  const personalSession = await getSession(personalSessionId);
  if (!personalSession) {
    return NextResponse.json({ error: 'Personal session not found' }, { status: 400 });
  }

  const MAX_PARTICIPANTS = 20;
  if (Object.keys(session.participants).length >= MAX_PARTICIPANTS) {
    return NextResponse.json({ error: 'Session is full' }, { status: 409 });
  }

  // Use personalSessionId as participantId so the user's color is consistent across groups
  const participantId = personalSessionId;
  const updated: Session = {
    ...session,
    participants: {
      ...session.participants,
      [participantId]: { personalSessionId },
    },
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
  // Refresh TTL — 90 days for personal sessions
  const ttl = session.type === 'personal' ? 90 * 86400 : undefined;
  await kv.set(`session:${id}`, updated, ttl ? { ex: ttl } : { keepTtl: true });
  return NextResponse.json({ ok: true });
}
