import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

interface MsEvent {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  showAs?: string;
  isAllDay?: boolean;
}

export async function fetchMicrosoftEvents(
  accessToken: string,
  lookAheadDays: number,
): Promise<BusyBlock[]> {
  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 86_400_000);

  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: until.toISOString(),
    $top: '1000',
    $select: 'start,end,showAs,isAllDay',
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Microsoft Graph API error: ${err?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const items: MsEvent[] = data.value ?? [];

  const raw = items.map((e) => ({
    // Microsoft returns UTC datetimes without 'Z' suffix — add it
    start: e.start?.dateTime ? e.start.dateTime.replace(/Z?$/, 'Z') : '',
    end: e.end?.dateTime ? e.end.dateTime.replace(/Z?$/, 'Z') : '',
    status: e.showAs === 'free' || e.showAs === 'oof' || e.showAs === 'workingElsewhere' ? 'free' : 'busy',
    allDay: e.isAllDay ?? false,
  })).filter(e => e.start && e.end);

  return anonymiseEvents(raw);
}
