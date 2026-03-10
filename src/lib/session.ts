import { Redis } from '@upstash/redis';

export const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
import bcrypt from 'bcryptjs';
import type { Session, BusyBlock } from '@/types';

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
  type?: 'personal' | 'group';
  name?: string;
}): Promise<{ sessionId: string; organizerToken: string }> {
  const sessionId = generateToken(12);
  const organizerToken = generateToken(32);
  const hashedToken = await bcrypt.hash(organizerToken, 10);
  const sessionType = opts.type ?? 'group';
  const session: Session = {
    sessionId,
    type: sessionType,
    ...(opts.name ? { name: opts.name } : {}),
    organizerToken: hashedToken,
    quorum: opts.quorum,
    lookAheadDays: opts.lookAheadDays,
    createdAt: new Date().toISOString(),
    participants: {},
  };
  const ttl = sessionType === 'personal' ? 90 * 86400 : (opts.expiryDays ?? 7) * 86400;
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

export async function resolveGroupParticipants(
  session: Session
): Promise<{ id: string; blocks: BusyBlock[] }[]> {
  const entries = Object.entries(session.participants);
  const results: { id: string; blocks: BusyBlock[] }[] = [];

  for (const [pid, value] of entries) {
    if (Array.isArray(value)) {
      // Legacy: blocks stored directly (backward compat)
      results.push({ id: pid, blocks: value });
    } else if (value && typeof value === 'object' && 'personalSessionId' in value) {
      // Reference: fetch from personal session
      const personalSession = await getSession(value.personalSessionId);
      if (personalSession) {
        const blocks = personalSession.participants['__organizer__'];
        if (Array.isArray(blocks)) {
          results.push({ id: pid, blocks });
        }
      }
    }
  }
  return results;
}

export async function refreshSessionTTL(sessionId: string, ttlSeconds: number): Promise<void> {
  await kv.expire(`session:${sessionId}`, ttlSeconds);
}

export const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

export function sanitiseBlocks(blocks: import('@/types').BusyBlock[]): import('@/types').BusyBlock[] {
  return blocks.map(b => ({
    start: String(b.start),
    end: String(b.end),
    busy: Boolean(b.busy),
    allDay: Boolean(b.allDay),
    ...(b.title ? { title: String(b.title).slice(0, 200) } : {}),
  }));
}
