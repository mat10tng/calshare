import type { BusyBlock } from '@/types';

interface RawEvent {
  start: string;
  end: string;
  status: string;
  allDay: boolean;
  [key: string]: unknown;
}

export function anonymiseEvents(events: RawEvent[]): BusyBlock[] {
  return events.map((e) => ({
    start: e.allDay ? e.start : new Date(e.start).toISOString(),
    end: e.allDay ? e.end : new Date(e.end).toISOString(),
    busy: e.status !== 'free',
    allDay: e.allDay,
  }));
}
