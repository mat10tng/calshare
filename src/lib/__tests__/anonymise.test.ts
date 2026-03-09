import { anonymiseEvents } from '../anonymise';

describe('anonymiseEvents', () => {
  it('strips all fields except start, end, busy, allDay', () => {
    const raw = [{
      id: 'abc', title: '1:1 with Sarah', description: 'Q1 review',
      attendees: ['a@b.com'], location: 'Room 4',
      start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z',
      status: 'busy', allDay: false,
    }];
    const result = anonymiseEvents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      start: '2026-03-10T09:00:00.000Z',
      end: '2026-03-10T10:00:00.000Z',
      busy: true,
      allDay: false,
    });
    expect(result[0]).not.toHaveProperty('title');
    expect(result[0]).not.toHaveProperty('id');
  });

  it('treats tentative events as busy', () => {
    const raw = [{ start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z', status: 'tentative', allDay: false }];
    expect(anonymiseEvents(raw)[0].busy).toBe(true);
  });

  it('treats free events as not busy', () => {
    const raw = [{ start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z', status: 'free', allDay: false }];
    expect(anonymiseEvents(raw)[0].busy).toBe(false);
  });

  it('normalises datetimes to UTC ISO strings', () => {
    const raw = [{ start: '2026-03-10T09:00:00+10:00', end: '2026-03-10T10:00:00+10:00', status: 'busy', allDay: false }];
    const result = anonymiseEvents(raw);
    expect(result[0].start).toBe('2026-03-09T23:00:00.000Z');
    expect(result[0].end).toBe('2026-03-10T00:00:00.000Z');
  });

  it('handles all-day events', () => {
    const raw = [{ start: '2026-03-10', end: '2026-03-11', status: 'busy', allDay: true }];
    const result = anonymiseEvents(raw);
    expect(result[0].allDay).toBe(true);
    expect(result[0].busy).toBe(true);
  });
});
