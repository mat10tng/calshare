import type { BusyBlock, UserPreferences, Weekday } from '@/types';

const DAY_NAMES: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWorkingWindow(date: string, prefs: UserPreferences): { start: Date; end: Date } | null {
  const d = new Date(date + 'T00:00:00.000Z');
  const dayName = DAY_NAMES[d.getUTCDay()];
  const hours = prefs.workingHours[dayName];
  if (!hours) return null;
  const [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);
  return {
    start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm)),
    end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), eh, em)),
  };
}

export function computeFreeSlots(
  busyBlocks: BusyBlock[],
  prefs: UserPreferences,
  fromDate: string,
  toDate: string,
): BusyBlock[] {
  const free: BusyBlock[] = [];
  const current = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T00:00:00.000Z');

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const window = getWorkingWindow(dateStr, prefs);
    if (window) {
      const dayBusy = busyBlocks
        .filter(b => b.busy && b.start.startsWith(dateStr))
        .sort((a, b) => a.start.localeCompare(b.start));

      let cursor = window.start;
      for (const block of dayBusy) {
        const bs = new Date(block.start);
        const be = new Date(block.end);
        if (bs > cursor) {
          free.push({ start: cursor.toISOString(), end: bs.toISOString(), busy: false, allDay: false });
        }
        const withBuffer = new Date(be.getTime() + prefs.bufferMinutes * 60_000);
        if (withBuffer > cursor) cursor = withBuffer;
      }
      if (cursor < window.end) {
        free.push({ start: cursor.toISOString(), end: window.end.toISOString(), busy: false, allDay: false });
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return free;
}

export function mergeGroupAvailability(
  participantBlocks: BusyBlock[][],
  prefs: UserPreferences,
  fromDate: string,
  toDate: string,
  quorum: number,
): BusyBlock[] {
  const freePerParticipant = participantBlocks.map(blocks =>
    computeFreeSlots(blocks, prefs, fromDate, toDate)
  );

  // Collect all boundary times
  const times = new Set<string>();
  freePerParticipant.flat().forEach(s => { times.add(s.start); times.add(s.end); });
  const sorted = [...times].sort();

  const result: BusyBlock[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const slotStart = sorted[i];
    const slotEnd = sorted[i + 1];
    const freeCount = freePerParticipant.filter(pFree =>
      pFree.some(s => s.start <= slotStart && s.end >= slotEnd)
    ).length;
    if (freeCount >= quorum) {
      if (result.length > 0 && result[result.length - 1].end === slotStart) {
        result[result.length - 1].end = slotEnd;
      } else {
        result.push({ start: slotStart, end: slotEnd, busy: false, allDay: false });
      }
    }
  }
  return result;
}
