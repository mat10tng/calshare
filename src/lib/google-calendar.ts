import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

interface GoogleEvent {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
  status?: string;
  summary?: string;
}

export async function fetchGoogleEvents(
  accessToken: string,
  lookAheadDays: number,
): Promise<BusyBlock[]> {
  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 86_400_000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google Calendar API error: ${err?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const items: GoogleEvent[] = data.items ?? [];

  const raw = items.map((e) => ({
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    status: e.transparency === 'transparent' || e.status === 'cancelled' ? 'free' : 'busy',
    allDay: !e.start?.dateTime,
    title: e.summary || undefined,
  })).filter(e => e.start && e.end);

  return anonymiseEvents(raw);
}
