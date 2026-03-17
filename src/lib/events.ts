import type { BusyBlock, CalendarEvent, RecurringEvent } from '@/types';

/**
 * Convert CalendarEvents to BusyBlocks for backend sync,
 * applying privacy filtering. Description is NEVER included.
 */
export function applyPrivacyFilter(events: CalendarEvent[]): BusyBlock[] {
  return events.map((e) => {
    const block: BusyBlock = {
      start: e.start,
      end: e.end,
      busy: e.busy,
      allDay: e.allDay,
    };
    if (e.sourceId) block.sourceId = e.sourceId;
    if (e.privacy !== 'busy-only' && e.title) {
      block.title = e.title;
    }
    return block;
  });
}

/**
 * Migrate existing BusyBlock[] → CalendarEvent[] for first-time migration.
 * All migrated events default to 'busy-only' privacy.
 */
export function migrateBlocksToEvents(blocks: BusyBlock[]): CalendarEvent[] {
  return blocks.map((b) => {
    let source: CalendarEvent['source'] = 'manual';
    if (b.sourceId?.startsWith('recurring:')) source = 'recurring';
    else if (b.sourceId) source = 'ics';

    return {
      id: crypto.randomUUID(),
      title: b.title ?? '',
      start: b.start,
      end: b.end,
      busy: b.busy,
      allDay: b.allDay,
      privacy: 'busy-only',
      source,
      sourceId: b.sourceId,
    };
  });
}

/**
 * Expand RecurringEvent[] into CalendarEvent[] for a given date range.
 */
export function expandRecurringToEvents(
  recurring: RecurringEvent[],
  lookAheadDays: number,
  fromDateStr?: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = fromDateStr ? new Date(fromDateStr + 'T00:00:00.000Z') : new Date();
  if (!fromDateStr) now.setUTCHours(0, 0, 0, 0);

  for (let d = 0; d <= lookAheadDays; d++) {
    const date = new Date(now.getTime() + d * 86_400_000);
    const dow = date.getUTCDay();
    const dateStr = date.toISOString().split('T')[0];

    for (const ev of recurring) {
      if (ev.dayOfWeek === dow) {
        const sh = String(ev.startHour).padStart(2, '0');
        const eh = String(ev.endHour).padStart(2, '0');
        events.push({
          id: `recurring:${ev.id}:${dateStr}`,
          title: ev.title,
          start: `${dateStr}T${sh}:00:00.000Z`,
          end: `${dateStr}T${eh}:00:00.000Z`,
          busy: true,
          allDay: false,
          privacy: ev.shareTitle ? 'full' : 'busy-only',
          source: 'recurring',
          sourceId: `recurring:${ev.id}`,
        });
      }
    }
  }
  return events;
}
