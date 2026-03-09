import ICAL from 'ical.js';
import { unzipSync, strFromU8 } from 'fflate';
import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

export function parseIcsFile(content: string): BusyBlock[] {
  let jcal: unknown;
  try {
    jcal = ICAL.parse(content);
  } catch {
    throw new Error('Invalid .ics file — could not parse calendar data.');
  }

  // ical.js types do not expose the internal jCal array structure returned by
  // ICAL.parse(), so the cast to `any` is required to satisfy the Component
  // constructor signature. The runtime behaviour is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp = new ICAL.Component(jcal as any);
  const vevents = comp.getAllSubcomponents('vevent');

  const raw = vevents.map((vevent) => {
    const event = new ICAL.Event(vevent);
    const transp = vevent.getFirstPropertyValue('transp') as string | null;
    return {
      start: event.startDate.toJSDate().toISOString(),
      end: event.endDate.toJSDate().toISOString(),
      status: transp === 'TRANSPARENT' ? 'free' : 'busy',
      allDay: event.startDate.isDate,
      title: event.summary || undefined,
    };
  });

  return anonymiseEvents(raw);
}

export async function parseZipFile(buffer: ArrayBuffer): Promise<BusyBlock[]> {
  const files = unzipSync(new Uint8Array(buffer));
  const icsEntries = Object.entries(files).filter(([name]) => name.endsWith('.ics'));

  if (icsEntries.length === 0) {
    throw new Error('No .ics files found in zip');
  }

  return icsEntries.flatMap(([, data]) => parseIcsFile(strFromU8(data)));
}
