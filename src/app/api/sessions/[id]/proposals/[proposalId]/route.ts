import { NextResponse } from 'next/server';
import { kv, getSession } from '@/lib/session';
import type { Session } from '@/types';

const CELL_RE = /^\d{4}-\d{2}-\d{2}:\d{1,2}$/;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const { id, proposalId } = await params;
  const body = await req.json();
  const { participantId, cells } = body as {
    participantId: string;
    cells: string[];
  };

  if (!participantId || !Array.isArray(cells)) {
    return NextResponse.json({ error: 'participantId and cells[] are required' }, { status: 400 });
  }
  if (cells.length > 500) {
    return NextResponse.json({ error: 'Too many cells' }, { status: 400 });
  }
  for (const c of cells) {
    if (!CELL_RE.test(c)) {
      return NextResponse.json({ error: `Invalid cell format: ${c}` }, { status: 400 });
    }
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (!(participantId in session.participants)) {
    return NextResponse.json({ error: 'Participant not found in session' }, { status: 403 });
  }

  const proposals = session.proposals ?? [];
  const proposalIndex = proposals.findIndex((p) => p.id === proposalId);
  if (proposalIndex === -1) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const proposal = { ...proposals[proposalIndex] };
  proposal.votes = { ...proposal.votes, [participantId]: cells };

  const updatedProposals = [...proposals];
  updatedProposals[proposalIndex] = proposal;

  const updated: Session = { ...session, proposals: updatedProposals };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ proposal });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const { id, proposalId } = await params;
  const body = await req.json();
  const { participantId } = body as { participantId: string };

  if (!participantId) {
    return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const proposals = session.proposals ?? [];
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (proposal.createdBy !== participantId) {
    return NextResponse.json({ error: 'Only the creator can dismiss a proposal' }, { status: 403 });
  }

  const updated: Session = {
    ...session,
    proposals: proposals.filter((p) => p.id !== proposalId),
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return new NextResponse(null, { status: 204 });
}
