import type { BusyBlock, CalendarEvent } from '@/types';

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

/**
 * Convert raw calendar events to CalendarEvent[] with privacy defaults.
 * Titles are preserved locally; privacy filtering happens at sync time.
 */
export function toCalendarEvents(
  events: RawEvent[],
  source: CalendarEvent['source'],
  sourceId?: string,
): CalendarEvent[] {
  if (!events) return [];
  return events.map((e) => ({
    id: crypto.randomUUID(),
    title: e.title ?? '',
    start: e.allDay ? e.start : toUtcIso(e.start),
    end: e.allDay ? e.end : toUtcIso(e.end),
    busy: e.status !== 'free',
    allDay: e.allDay,
    privacy: 'busy-only' as const,
    source,
    sourceId,
  }));
}
