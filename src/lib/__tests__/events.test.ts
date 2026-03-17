import { applyPrivacyFilter, migrateBlocksToEvents, expandRecurringToEvents } from '../events';
import type { CalendarEvent, BusyBlock, RecurringEvent } from '@/types';

describe('applyPrivacyFilter', () => {
  const base: CalendarEvent = {
    id: '1',
    title: 'Secret Meeting',
    description: 'Very confidential',
    start: '2026-03-17T09:00:00.000Z',
    end: '2026-03-17T10:00:00.000Z',
    busy: true,
    allDay: false,
    privacy: 'busy-only',
    source: 'manual',
  };

  it('strips title and description for busy-only privacy', () => {
    const blocks = applyPrivacyFilter([base]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBeUndefined();
    expect(blocks[0]).not.toHaveProperty('description');
    expect(blocks[0].busy).toBe(true);
    expect(blocks[0].start).toBe('2026-03-17T09:00:00.000Z');
  });

  it('includes title for full privacy', () => {
    const blocks = applyPrivacyFilter([{ ...base, privacy: 'full' }]);
    expect(blocks[0].title).toBe('Secret Meeting');
    expect(blocks[0]).not.toHaveProperty('description');
  });

  it('includes title for title-only privacy', () => {
    const blocks = applyPrivacyFilter([{ ...base, privacy: 'title-only' }]);
    expect(blocks[0].title).toBe('Secret Meeting');
    expect(blocks[0]).not.toHaveProperty('description');
  });

  it('never includes description regardless of privacy', () => {
    for (const privacy of ['full', 'title-only', 'busy-only'] as const) {
      const blocks = applyPrivacyFilter([{ ...base, privacy }]);
      expect(blocks[0]).not.toHaveProperty('description');
    }
  });

  it('includes free events (busy: false)', () => {
    const blocks = applyPrivacyFilter([{ ...base, busy: false }]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].busy).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(applyPrivacyFilter([])).toEqual([]);
  });

  it('preserves sourceId', () => {
    const blocks = applyPrivacyFilter([{ ...base, sourceId: 'src-1' }]);
    expect(blocks[0].sourceId).toBe('src-1');
  });
});

describe('migrateBlocksToEvents', () => {
  it('converts BusyBlock to CalendarEvent with busy-only privacy', () => {
    const block: BusyBlock = {
      start: '2026-03-17T09:00:00.000Z',
      end: '2026-03-17T10:00:00.000Z',
      busy: true,
      allDay: false,
    };
    const events = migrateBlocksToEvents([block]);
    expect(events).toHaveLength(1);
    expect(events[0].privacy).toBe('busy-only');
    expect(events[0].title).toBe('');
    expect(events[0].source).toBe('manual');
    expect(events[0].id).toBeTruthy();
  });

  it('preserves title from block if present', () => {
    const block: BusyBlock = {
      start: '2026-03-17T09:00:00.000Z',
      end: '2026-03-17T10:00:00.000Z',
      busy: true,
      allDay: false,
      title: 'Standup',
    };
    const events = migrateBlocksToEvents([block]);
    expect(events[0].title).toBe('Standup');
  });

  it('infers recurring source from sourceId', () => {
    const block: BusyBlock = {
      start: '2026-03-17T09:00:00.000Z',
      end: '2026-03-17T10:00:00.000Z',
      busy: true,
      allDay: false,
      sourceId: 'recurring:abc',
    };
    const events = migrateBlocksToEvents([block]);
    expect(events[0].source).toBe('recurring');
  });

  it('returns empty array for empty input', () => {
    expect(migrateBlocksToEvents([])).toEqual([]);
  });
});

describe('expandRecurringToEvents', () => {
  it('expands a weekly recurring event', () => {
    const recurring: RecurringEvent = {
      id: 'r1',
      title: 'Muay Thai',
      dayOfWeek: 2, // Tuesday
      startHour: 18,
      endHour: 19,
    };
    // 2026-03-17 is a Tuesday, lookAhead 7 days covers 2 Tuesdays
    const events = expandRecurringToEvents([recurring], 7, '2026-03-17');
    const tuesdays = events.filter(e => e.title === 'Muay Thai');
    expect(tuesdays.length).toBe(2); // Mar 17, Mar 24
    expect(tuesdays[0].source).toBe('recurring');
    expect(tuesdays[0].start).toContain('18:00:00');
    expect(tuesdays[0].end).toContain('19:00:00');
  });

  it('sets privacy based on shareTitle', () => {
    const recurring: RecurringEvent = {
      id: 'r1',
      title: 'Muay Thai',
      dayOfWeek: 2,
      startHour: 18,
      endHour: 19,
      shareTitle: true,
    };
    const events = expandRecurringToEvents([recurring], 0, '2026-03-17');
    expect(events[0].privacy).toBe('full');
  });

  it('defaults to busy-only when shareTitle is false/undefined', () => {
    const recurring: RecurringEvent = {
      id: 'r1',
      title: 'Muay Thai',
      dayOfWeek: 2,
      startHour: 18,
      endHour: 19,
    };
    const events = expandRecurringToEvents([recurring], 0, '2026-03-17');
    expect(events[0].privacy).toBe('busy-only');
  });

  it('returns empty for no matching days', () => {
    const recurring: RecurringEvent = {
      id: 'r1',
      title: 'Muay Thai',
      dayOfWeek: 3, // Wednesday
      startHour: 18,
      endHour: 19,
    };
    const events = expandRecurringToEvents([recurring], 0, '2026-03-17'); // Tuesday only
    expect(events).toHaveLength(0);
  });
});
