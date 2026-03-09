import { NextResponse } from 'next/server';
import { kv, verifyOrganizerToken } from '@/lib/session';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyOrganizerToken(id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    participants: Object.entries(session.participants).map(([pid, blocks]) => ({ id: pid, blocks })),
    quorum: session.quorum,
    lookAheadDays: session.lookAheadDays,
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
