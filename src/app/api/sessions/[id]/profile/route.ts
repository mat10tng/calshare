import { NextResponse } from 'next/server';
import { kv, verifyOrganizerToken } from '@/lib/session';
import type { Session } from '@/types';

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
  const { displayName, userColor } = body as { displayName?: string; userColor?: string };

  const updated: Session = { ...session };

  if (typeof displayName === 'string') {
    const trimmed = displayName.trim().slice(0, 30);
    if (trimmed) updated.displayName = trimmed;
    else delete updated.displayName;
  } else if (displayName === null) {
    delete updated.displayName;
  }

  if (typeof userColor === 'string') {
    const trimmed = userColor.trim().slice(0, 50);
    if (trimmed) updated.userColor = trimmed;
    else delete updated.userColor;
  } else if (userColor === null) {
    delete updated.userColor;
  }

  const ttl = session.type === 'personal' ? 90 * 86400 : undefined;
  await kv.set(`session:${id}`, updated, ttl ? { ex: ttl } : { keepTtl: true });
  return NextResponse.json({ ok: true });
}
