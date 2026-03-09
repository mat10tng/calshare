import { Redis } from '@upstash/redis';

export const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
import bcrypt from 'bcryptjs';
import type { Session } from '@/types';

export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function createSession(opts: {
  quorum: number;
  lookAheadDays: number;
  expiryDays?: number;
}): Promise<{ sessionId: string; organizerToken: string }> {
  const sessionId = generateToken(12);
  const organizerToken = generateToken(32);
  const hashedToken = await bcrypt.hash(organizerToken, 10);
  const session: Session = {
    sessionId,
    organizerToken: hashedToken,
    quorum: opts.quorum,
    lookAheadDays: opts.lookAheadDays,
    createdAt: new Date().toISOString(),
    participants: {},
  };
  const ttl = (opts.expiryDays ?? 7) * 86400;
  await kv.set(`session:${sessionId}`, session, { ex: ttl });
  return { sessionId, organizerToken };
}

export async function verifyOrganizerToken(sessionId: string, token: string): Promise<Session | null> {
  const session = await kv.get<Session>(`session:${sessionId}`);
  if (!session) return null;
  const valid = await bcrypt.compare(token, session.organizerToken);
  return valid ? session : null;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return kv.get<Session>(`session:${sessionId}`);
}
