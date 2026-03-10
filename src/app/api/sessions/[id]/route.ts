import { NextResponse } from 'next/server';
import { kv, getSession, verifyOrganizerToken, resolveGroupParticipants } from '@/lib/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const participants = await resolveGroupParticipants(session);

  // Build participantId → personalSessionId mapping so clients can identify themselves
  const personalSessionMap: Record<string, string> = {};
  for (const [pid, value] of Object.entries(session.participants)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'personalSessionId' in value) {
      personalSessionMap[pid] = (value as { personalSessionId: string }).personalSessionId;
    }
  }

  return NextResponse.json({
    participants,
    quorum: session.quorum,
    lookAheadDays: session.lookAheadDays,
    personalSessionMap,
    proposals: session.proposals ?? [],
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyOrganizerToken(id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await kv.del(`session:${id}`);
  return new NextResponse(null, { status: 204 });
}
