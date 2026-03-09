import { computeFreeSlots, mergeGroupAvailability } from '../merge';
import type { BusyBlock, UserPreferences } from '@/types';

const defaultPrefs: UserPreferences = {
  workingHours: {
    Mon: { start: '09:00', end: '17:00' },
    Tue: { start: '09:00', end: '17:00' },
    Wed: { start: '09:00', end: '17:00' },
    Thu: { start: '09:00', end: '17:00' },
    Fri: { start: '09:00', end: '17:00' },
    Sat: null,
    Sun: null,
  },
  blockedWindows: [],
  bufferMinutes: 0,
  lookAheadDays: 7,
};

describe('computeFreeSlots', () => {
  it('returns working hours minus busy blocks', () => {
    // 2026-03-09 is a Monday
    const busy: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    const free = computeFreeSlots(busy, defaultPrefs, '2026-03-09', '2026-03-09');
    // Should have a free slot starting at 10:00
    expect(free.some(s => s.start === '2026-03-09T10:00:00.000Z')).toBe(true);
    // All free slots must be within working hours
    expect(free.every(s => s.start >= '2026-03-09T09:00:00.000Z')).toBe(true);
  });

  it('applies buffer time between slots', () => {
    const prefs = { ...defaultPrefs, bufferMinutes: 30 };
    const busy: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    const free = computeFreeSlots(busy, prefs, '2026-03-09', '2026-03-09');
    // First free slot should start 30 min after busy block ends
    expect(free[0].start).toBe('2026-03-09T10:30:00.000Z');
  });

  it('excludes weekends when not in working hours', () => {
    const busy: BusyBlock[] = [];
    // 2026-03-07 is a Saturday
    const free = computeFreeSlots(busy, defaultPrefs, '2026-03-07', '2026-03-07');
    expect(free).toHaveLength(0);
  });

  it('returns full working day when no busy blocks', () => {
    const free = computeFreeSlots([], defaultPrefs, '2026-03-09', '2026-03-09');
    expect(free).toHaveLength(1);
    expect(free[0].start).toBe('2026-03-09T09:00:00.000Z');
    expect(free[0].end).toBe('2026-03-09T17:00:00.000Z');
  });

  it('returns empty array for fully booked day', () => {
    const busy: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T17:00:00.000Z', busy: true, allDay: false },
    ];
    const free = computeFreeSlots(busy, defaultPrefs, '2026-03-09', '2026-03-09');
    expect(free).toHaveLength(0);
  });
});

describe('mergeGroupAvailability', () => {
  it('finds slots where all participants are free', () => {
    const p1: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    const p2: BusyBlock[] = [
      { start: '2026-03-09T14:00:00.000Z', end: '2026-03-09T15:00:00.000Z', busy: true, allDay: false },
    ];
    const result = mergeGroupAvailability([p1, p2], defaultPrefs, '2026-03-09', '2026-03-09', 2);
    // 10:00-14:00 should be free for both
    expect(result.some(s =>
      s.start <= '2026-03-09T10:00:00.000Z' && s.end >= '2026-03-09T14:00:00.000Z'
    )).toBe(true);
  });

  it('respects quorum — shows slots where at least N are free', () => {
    const p1: BusyBlock[] = [];
    const p2: BusyBlock[] = [];
    const p3: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T17:00:00.000Z', busy: true, allDay: false },
    ];
    // quorum=2, p3 busy all day — p1+p2 still free, meets quorum
    const result = mergeGroupAvailability([p1, p2, p3], defaultPrefs, '2026-03-09', '2026-03-09', 2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty when no quorum is met', () => {
    const p1: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T17:00:00.000Z', busy: true, allDay: false },
    ];
    const p2: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T17:00:00.000Z', busy: true, allDay: false },
    ];
    // quorum=2, both busy all day
    const result = mergeGroupAvailability([p1, p2], defaultPrefs, '2026-03-09', '2026-03-09', 2);
    expect(result).toHaveLength(0);
  });
});
