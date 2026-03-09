import type { BusyBlock } from '@/types';

type EventStatus = 'free' | 'busy' | 'tentative' | (string & {});

interface RawEvent {
  start: string;
  end: string;
  status: EventStatus;
  allDay: boolean;
  title?: string;
  [key: string]: unknown;
}

function toUtcIso(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid date string: "${dateStr}"`);
  return d.toISOString();
}

export function anonymiseEvents(events: RawEvent[]): BusyBlock[] {
  if (!events) return [];
  return events.map((e) => ({
    start: e.allDay ? e.start : toUtcIso(e.start),
    end: e.allDay ? e.end : toUtcIso(e.end),
    busy: e.status !== 'free',
    allDay: e.allDay,
  }));
}
