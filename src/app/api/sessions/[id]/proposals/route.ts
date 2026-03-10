import { NextResponse } from 'next/server';
import { kv, getSession, generateToken, ISO_RE } from '@/lib/session';
import type { Proposal, Session } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, start, end, participantId } = body as {
    title: string;
    start: string;
    end: string;
    participantId: string;
  };

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
    return NextResponse.json({ error: 'Title must be a non-empty string (max 100 chars)' }, { status: 400 });
  }
  if (!start || !end || !ISO_RE.test(start) || !ISO_RE.test(end)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  if (!participantId) {
    return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Verify participant exists in session
  if (!(participantId in session.participants)) {
    return NextResponse.json({ error: 'Participant not found in session' }, { status: 403 });
  }

  const proposals = session.proposals ?? [];
  if (proposals.length >= 10) {
    return NextResponse.json({ error: 'Maximum proposals reached (10)' }, { status: 409 });
  }

  const proposal: Proposal = {
    id: generateToken(8),
    title: title.trim(),
    start,
    end,
    createdBy: participantId,
    createdAt: new Date().toISOString(),
    votes: {},
  };

  const updated: Session = {
    ...session,
    proposals: [...proposals, proposal],
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ proposal }, { status: 201 });
}
