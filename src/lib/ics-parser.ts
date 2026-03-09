import ICAL from 'ical.js';
import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

export function parseIcsFile(content: string): BusyBlock[] {
  let jcal: unknown;
  try {
    jcal = ICAL.parse(content);
  } catch {
    throw new Error('Invalid .ics file — could not parse calendar data.');
  }

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
    };
  });

  return anonymiseEvents(raw);
}
