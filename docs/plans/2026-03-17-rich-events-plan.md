# Rich Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade CalShare from anonymous busy/free blocks to a proper event system with titles, exact times, descriptions, and per-event granular privacy controls.

**Architecture:** Add a `CalendarEvent` type as the local source of truth in localStorage. Events convert to `BusyBlock` (the existing wire format) via a privacy filter before syncing to Redis. No backend changes needed.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Upstash Redis, Jest 30

**Design doc:** `docs/plans/2026-03-17-rich-events-design.md`

---

### Task 0: Add CalendarEvent and EventPrivacy types

**Files:**
- Modify: `src/types/index.ts` (after line 8, after BusyBlock)

**Step 1: Add the new types after BusyBlock**

Add these types to `src/types/index.ts` right after the `BusyBlock` interface (after line 8):

```typescript
export type EventPrivacy = 'full' | 'title-only' | 'busy-only';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;   // ISO 8601 UTC (exact time)
  end: string;     // ISO 8601 UTC (exact time)
  busy: boolean;
  allDay: boolean;
  privacy: EventPrivacy;
  source: 'manual' | 'google' | 'outlook' | 'ics' | 'recurring';
  sourceId?: string;
  color?: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors may be present)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add CalendarEvent and EventPrivacy types"
```

---

### Task 1: Create events.ts with privacy filter and migration

**Files:**
- Create: `src/lib/events.ts`
- Create: `src/lib/__tests__/events.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/events.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/events.test.ts 2>&1 | tail -5`
Expected: FAIL — module not found

**Step 3: Implement events.ts**

Create `src/lib/events.ts`:

```typescript
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
    else if (b.sourceId) source = 'ics'; // generic imported source

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
 * @param fromDateStr - YYYY-MM-DD start date (defaults to today)
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
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/events.test.ts --verbose 2>&1 | tail -20`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/events.ts src/lib/__tests__/events.test.ts
git commit -m "feat: add events.ts with privacy filter, migration, and recurring expansion"
```

---

### Task 2: Update AppContext to add events state and CRUD actions

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add events to AppState and new Action types**

In `src/context/AppContext.tsx`, add `CalendarEvent` to the import from `@/types` (line 3):

```typescript
import type { BusyBlock, CalendarSource, UserPreferences, GroupEntry, RecurringEvent, CalendarEvent } from '@/types';
```

Add `events: CalendarEvent[]` to the `AppState` interface (after line 56, add after `recurringEvents`):

```typescript
  events: CalendarEvent[];
```

Add new action types to the `Action` union (after line 74, before `SET_RECURRING_EVENTS`):

```typescript
  | { type: 'SET_EVENTS'; events: CalendarEvent[] }
  | { type: 'ADD_EVENT'; event: CalendarEvent }
  | { type: 'UPDATE_EVENT'; id: string; changes: Partial<CalendarEvent> }
  | { type: 'REMOVE_EVENT'; id: string }
  | { type: 'IMPORT_EVENTS'; source: CalendarSource; events: CalendarEvent[] }
```

**Step 2: Add reducer cases**

Add these cases to the reducer function, before the `default` case (before line 126):

```typescript
    case 'SET_EVENTS':
      return { ...state, events: action.events };
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.event] };
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e =>
          e.id === action.id ? { ...e, ...action.changes } : e
        ),
      };
    case 'REMOVE_EVENT':
      return { ...state, events: state.events.filter(e => e.id !== action.id) };
    case 'IMPORT_EVENTS':
      return {
        ...state,
        sources: [...state.sources, action.source],
        events: [...state.events, ...action.events],
      };
```

**Step 3: Initialize events in INITIAL_STATE**

Add `events: []` to `INITIAL_STATE` (line 140, after `recurringEvents: []`):

```typescript
  events: [],
```

**Step 4: Add localStorage persistence for events**

In the hydration `useEffect` (around line 237, after loading `recurringEvents`), add:

```typescript
      const savedEvents = localStorage.getItem('calshare:events');
      if (savedEvents) {
        dispatch({ type: 'SET_EVENTS', events: JSON.parse(savedEvents) });
      }
```

Add a new persistence `useEffect` (after the `recurringEvents` one, around line 316):

```typescript
  useEffect(() => {
    try {
      localStorage.setItem('calshare:events', JSON.stringify(state.events));
    } catch { /* ignore */ }
  }, [state.events]);
```

**Step 5: Update sync to include events in the block pipeline**

Import `applyPrivacyFilter` at the top of the file:

```typescript
import { applyPrivacyFilter } from '@/lib/events';
```

In the sync `useEffect` (around line 273), update the block composition to include events:

Change:
```typescript
      const recurringBlocks = expandRecurringEvents(s.recurringEvents, s.preferences.lookAheadDays);
      syncBlocksToBackend([...s.blocks, ...recurringBlocks], s, dispatch);
```

To:
```typescript
      const recurringBlocks = expandRecurringEvents(s.recurringEvents, s.preferences.lookAheadDays);
      const eventBlocks = applyPrivacyFilter(s.events);
      syncBlocksToBackend([...s.blocks, ...recurringBlocks, ...eventBlocks], s, dispatch);
```

Add `state.events` to the dependency array of this `useEffect`.

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 7: Run existing tests to check nothing broke**

Run: `npx jest 2>&1 | tail -10`
Expected: All existing tests still pass

**Step 8: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add events state, CRUD actions, persistence, and sync pipeline to AppContext"
```

---

### Task 3: Create EventModal component

**Files:**
- Create: `src/components/EventModal.tsx`

**Step 1: Create the component**

Create `src/components/EventModal.tsx`:

```typescript
'use client';
import { useState } from 'react';
import type { CalendarEvent, EventPrivacy } from '@/types';

interface Props {
  event?: CalendarEvent;
  defaultDate?: string;   // YYYY-MM-DD
  defaultHour?: number;   // 0-23
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
}

const PRIVACY_OPTIONS: { value: EventPrivacy; label: string; desc: string }[] = [
  { value: 'busy-only', label: 'Busy only', desc: 'Others see a busy block, no details' },
  { value: 'title-only', label: 'Title only', desc: 'Others see the event title' },
  { value: 'full', label: 'Share everything', desc: 'Others see title and time details' },
];

export function EventModal({ event, defaultDate, defaultHour, onSave, onCancel }: Props) {
  const isEdit = !!event;
  const isImported = event ? event.source !== 'manual' : false;

  const today = new Date().toISOString().split('T')[0];
  const initDate = event
    ? event.start.split('T')[0]
    : (defaultDate ?? today);
  const initStartHour = event
    ? new Date(event.start).getUTCHours()
    : (defaultHour ?? 9);
  const initStartMin = event
    ? new Date(event.start).getUTCMinutes()
    : 0;
  const initEndHour = event
    ? new Date(event.end).getUTCHours()
    : Math.min(initStartHour + 1, 23);
  const initEndMin = event
    ? new Date(event.end).getUTCMinutes()
    : 0;

  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(initDate);
  const [startHour, setStartHour] = useState(initStartHour);
  const [startMin, setStartMin] = useState(initStartMin);
  const [endHour, setEndHour] = useState(initEndHour);
  const [endMin, setEndMin] = useState(initEndMin);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [busy, setBusy] = useState(event?.busy ?? true);
  const [privacy, setPrivacy] = useState<EventPrivacy>(event?.privacy ?? 'busy-only');
  const [description, setDescription] = useState(event?.description ?? '');

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const isValid = title.trim().length > 0 && (allDay || endMinutes > startMinutes);

  function handleSave() {
    if (!isValid) return;

    const sh = String(startHour).padStart(2, '0');
    const sm = String(startMin).padStart(2, '0');
    const eh = String(endHour).padStart(2, '0');
    const em = String(endMin).padStart(2, '0');

    const saved: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
      start: allDay ? date : `${date}T${sh}:${sm}:00.000Z`,
      end: allDay ? date : `${date}T${eh}:${em}:00.000Z`,
      busy,
      allDay,
      privacy,
      source: event?.source ?? 'manual',
      sourceId: event?.sourceId,
      color: event?.color,
    };

    onSave(saved);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md mx-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          {isEdit ? 'Edit event' : 'New event'}
        </h2>

        {/* Title */}
        <div className="mb-3">
          <label className="label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Team standup"
            className="input w-full"
            maxLength={100}
            disabled={isImported}
            autoFocus
          />
        </div>

        {/* Date */}
        <div className="mb-3">
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            disabled={isImported}
          />
        </div>

        {/* All day toggle */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            disabled={isImported}
          />
          <label htmlFor="allDay" className="text-sm" style={{ color: 'var(--foreground)' }}>All day</label>
        </div>

        {/* Time pickers */}
        {!allDay && (
          <div className="mb-3 flex gap-3">
            <div className="flex-1">
              <label className="label">Start</label>
              <div className="flex gap-1">
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="label">End</label>
              <div className="flex gap-1">
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={endMin}
                  onChange={(e) => setEndMin(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Busy/Free */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="busy"
            checked={busy}
            onChange={(e) => setBusy(e.target.checked)}
          />
          <label htmlFor="busy" className="text-sm" style={{ color: 'var(--foreground)' }}>
            Mark as busy
          </label>
        </div>

        {/* Privacy */}
        <div className="mb-3">
          <label className="label">Sharing</label>
          <div className="flex flex-col gap-1.5">
            {PRIVACY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer"
                style={{
                  background: privacy === opt.value ? 'var(--card-bg)' : 'transparent',
                  border: `1px solid ${privacy === opt.value ? 'var(--border-strong)' : 'transparent'}`,
                }}
              >
                <input
                  type="radio"
                  name="privacy"
                  value={opt.value}
                  checked={privacy === opt.value}
                  onChange={() => setPrivacy(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{opt.label}</span>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="label">
            Notes <span className="label-hint">(private — never shared)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes for yourself..."
            className="input w-full"
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Time validation error */}
        {!allDay && endMinutes <= startMinutes && title.trim().length > 0 && (
          <p className="msg-error mb-3">End time must be after start time</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="btn btn-primary btn-sm"
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/components/EventModal.tsx
git commit -m "feat: add EventModal component for creating and editing events"
```

---

### Task 4: Integrate EventModal into /me page

**Files:**
- Modify: `src/app/me/page.tsx`

**Step 1: Add event modal state and imports**

At the top of `src/app/me/page.tsx`, update the imports (line 9):

Add `CalendarEvent` to the type import:
```typescript
import type { BusyBlock, RecurringEvent, CalendarEvent } from '@/types';
```

Add the EventModal import:
```typescript
import { EventModal } from '@/components/EventModal';
```

**Step 2: Add modal state variables**

Inside the `AvailabilityPage` component, after the existing useState calls (around line 34), add:

```typescript
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [createFromDate, setCreateFromDate] = useState<string | null>(null);
  const [createFromHour, setCreateFromHour] = useState<number | undefined>(undefined);
  const showEventModal = editingEvent !== null || createFromDate !== null;
```

**Step 3: Add event save/delete handlers**

After the `handleLeave` function (around line 118), add:

```typescript
  function handleSaveEvent(event: CalendarEvent) {
    if (editingEvent) {
      dispatch({ type: 'UPDATE_EVENT', id: editingEvent.id, changes: event });
    } else {
      dispatch({ type: 'ADD_EVENT', event });
    }
    setEditingEvent(null);
    setCreateFromDate(null);
    setCreateFromHour(undefined);
  }

  function handleCancelEvent() {
    setEditingEvent(null);
    setCreateFromDate(null);
    setCreateFromHour(undefined);
  }
```

**Step 4: Add "Add Event" button in the header**

In the button group (around line 203), add the new button before "Connect calendar":

```typescript
            <button
              onClick={() => setCreateFromDate(now)}
              className="btn btn-primary btn-sm"
            >
              + Add event
            </button>
```

**Step 5: Add EventModal to the JSX**

At the end of the component's return statement, before the closing `</>` (line 371), add:

```typescript
        {showEventModal && (
          <EventModal
            event={editingEvent ?? undefined}
            defaultDate={createFromDate ?? undefined}
            defaultHour={createFromHour}
            onSave={handleSaveEvent}
            onCancel={handleCancelEvent}
          />
        )}
```

**Step 6: Include events in the allBlocks merge**

The current `allBlocks` merges `state.blocks` + `recurringBlocks`. Add events converted to blocks for grid display. Import `applyPrivacyFilter`:

```typescript
import { applyPrivacyFilter } from '@/lib/events';
```

Update the `allBlocks` useMemo (around line 73):

```typescript
  const eventBlocks = useMemo(() => {
    return applyPrivacyFilter(state.events);
  }, [state.events]);

  const allBlocks = useMemo(() => {
    return [...state.blocks, ...recurringBlocks, ...eventBlocks];
  }, [state.blocks, recurringBlocks, eventBlocks]);
```

Note: For the personal grid, we actually want to show full event details locally. But since `allBlocks` is `BusyBlock[]` (which the grid already understands), this works. The privacy filter only strips data for backend sync — locally we could show all titles. For now, use `applyPrivacyFilter` with `'full'` override for local display. But actually, the simplest approach: convert events to BusyBlocks with titles included for local display (full privacy locally):

```typescript
  const eventBlocks = useMemo((): BusyBlock[] => {
    return state.events.map(e => ({
      start: e.start,
      end: e.end,
      busy: e.busy,
      allDay: e.allDay,
      title: e.title || undefined,
      sourceId: e.sourceId,
    }));
  }, [state.events]);
```

This way the user always sees their own event titles on the grid, regardless of privacy setting. Privacy only affects what others see.

**Step 7: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 8: Commit**

```bash
git add src/app/me/page.tsx
git commit -m "feat: integrate EventModal into /me page with add event button"
```

---

### Task 5: Display event titles on the availability grid

**Files:**
- Modify: `src/components/AvailabilityGrid.tsx`

**Step 1: Add a title lookup function**

In `AvailabilityGrid.tsx`, after the existing `buildBusySet` function (around line 77), add a function to build a map of cell keys → event titles from blocks that have titles:

```typescript
function buildTitleMap(blocks: BusyBlock[], dates: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const dateSet = new Set(dates);
  for (const b of blocks) {
    if (!b.title) continue;
    const date = b.start.split('T')[0];
    const datesToCheck = dateSet.has(date) ? [date] : dates;
    for (const d of datesToCheck) {
      for (const h of HOURS) {
        const slotStart = new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`);
        const slotEnd = new Date(slotStart.getTime() + 3_600_000);
        const start = new Date(b.start);
        const end = new Date(b.end);
        if (start < slotEnd && end > slotStart) {
          const key = `${d}:${h}`;
          if (!map.has(key)) map.set(key, b.title);
        }
      }
    }
  }
  return map;
}
```

**Step 2: Compute title map in the component**

After the `busySet` useMemo (around line 170), add:

```typescript
  const titleMap = useMemo(() => buildTitleMap(blocks, dates), [blocks, dates]);
```

**Step 3: Render titles in personal mode grid cells**

In the personal mode `<td>` (the last case, around line 686-703), add a title label inside the cell. Replace the cell's children:

Before (around line 698-701):
```tsx
                    >
                      {hasProposalDot && proposalColors!.map((c, i) => (
                          <div key={i} className="grid-cell-proposal-dot" style={{ background: c, right: 2 + i * 5 }} />
                        ))}
                    </td>
```

After:
```tsx
                      style={{
                        ...(busyColor && isBusy ? { background: busyColor, borderColor: 'transparent' } : undefined),
                        ...(needsRelative || titleMap.has(key) ? { position: 'relative' as const } : undefined),
                        ...(suggestMode ? { cursor: 'pointer' } : undefined),
                      }}
                    >
                      {titleMap.has(key) && (
                        <span className="grid-cell-title">{titleMap.get(key)}</span>
                      )}
                      {hasProposalDot && proposalColors!.map((c, i) => (
                          <div key={i} className="grid-cell-proposal-dot" style={{ background: c, right: 2 + i * 5 }} />
                        ))}
                    </td>
```

**Step 4: Add CSS for the title label**

In `src/app/globals.css`, add after the existing grid styles:

```css
.grid-cell-title {
  position: absolute;
  inset: 1px;
  font-size: 0.6rem;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255,255,255,0.85);
  pointer-events: none;
  padding: 1px 2px;
}
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add src/components/AvailabilityGrid.tsx src/app/globals.css
git commit -m "feat: display event titles on availability grid cells"
```

---

### Task 6: Update connect page to import as CalendarEvents

**Files:**
- Modify: `src/app/me/connect/page.tsx`
- Modify: `src/lib/anonymise.ts`

**Step 1: Add a new function to anonymise.ts that returns CalendarEvents**

In `src/lib/anonymise.ts`, add an import and a new function:

```typescript
import type { BusyBlock, CalendarEvent } from '@/types';

// ... existing anonymiseEvents function stays ...

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
```

**Step 2: Update connect page to dispatch IMPORT_EVENTS**

In `src/app/me/connect/page.tsx`:

Update the import to include `CalendarEvent`:
```typescript
import type { BusyBlock, CalendarEvent } from '@/types';
```

Add import for `toCalendarEvents`:
```typescript
import { toCalendarEvents } from '@/lib/anonymise';
```

Change the `PendingImport` interface to support both legacy blocks and new events:
```typescript
interface PendingImport {
  blocks: BusyBlock[];
  events: CalendarEvent[];
  source: string;
}
```

Update `handleConfirm` to dispatch events if available:
```typescript
  function handleConfirm(blocks: BusyBlock[]) {
    if (pending?.events && pending.events.length > 0) {
      const sourceObj = {
        id: crypto.randomUUID(),
        label: pending.source,
        category: null,
        addedAt: new Date().toISOString(),
      };
      dispatch({ type: 'IMPORT_EVENTS', source: sourceObj, events: pending.events });
    } else {
      dispatch({ type: 'ADD_BLOCKS', blocks });
    }
    setPending(null);
    router.push('/me');
  }
```

Update each place where `setPending` is called to also pass events. For example, the Google OAuth flow (around line 51):
```typescript
          const rawEvents = await fetchGoogleEvents(token, state.preferences.lookAheadDays);
          const events = toCalendarEvents(rawEvents, 'google');
          setPending({ blocks: rawEvents, events, source: 'Google Calendar' });
```

Note: `fetchGoogleEvents` currently returns `BusyBlock[]` (already anonymised). To get raw events for `toCalendarEvents`, we would need to refactor the Google/Microsoft fetch functions. **For this task, keep the existing import flow unchanged** — the connect page continues to dispatch `ADD_BLOCKS` for imported calendars. Event creation via the modal is the new path. Refactoring imports to use CalendarEvent can be a follow-up task.

**Simplified Step 2:** Actually, don't change the connect page yet. The import functions (`fetchGoogleEvents`, `fetchMicrosoftEvents`, `parseIcsFile`) all return `BusyBlock[]` already. Changing them to return raw events requires touching those files too. Keep this as a future enhancement.

Instead, just add the `toCalendarEvents` function to `anonymise.ts` for future use, and commit.

**Step 3: Write a test for toCalendarEvents**

Add to `src/lib/__tests__/anonymise.test.ts`:

```typescript
import { toCalendarEvents } from '../anonymise';

describe('toCalendarEvents', () => {
  it('converts raw events to CalendarEvents with busy-only privacy', () => {
    const raw = [{
      title: 'Meeting',
      start: '2026-03-17T09:00:00Z',
      end: '2026-03-17T10:00:00Z',
      status: 'busy' as const,
      allDay: false,
    }];
    const result = toCalendarEvents(raw, 'google');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting');
    expect(result[0].privacy).toBe('busy-only');
    expect(result[0].source).toBe('google');
    expect(result[0].id).toBeTruthy();
  });

  it('returns empty array for null input', () => {
    expect(toCalendarEvents(null as any, 'ics')).toEqual([]);
  });
});
```

**Step 4: Run tests**

Run: `npx jest src/lib/__tests__/anonymise.test.ts --verbose 2>&1 | tail -15`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/anonymise.ts src/lib/__tests__/anonymise.test.ts
git commit -m "feat: add toCalendarEvents function for future import refactoring"
```

---

### Task 7: Add migration logic for existing localStorage data

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Import migrateBlocksToEvents**

Add to the imports at the top of AppContext.tsx:

```typescript
import { applyPrivacyFilter, migrateBlocksToEvents } from '@/lib/events';
```

**Step 2: Add migration in the hydration effect**

In the hydration `useEffect`, after loading `calshare:events`, add migration logic. The flow: if `calshare:events` is empty/missing but `calshare:blocks` has data, migrate blocks to events.

After the existing events loading code, add:

```typescript
      // Migrate legacy blocks to events if events are empty
      const hasEvents = savedEvents && JSON.parse(savedEvents).length > 0;
      if (!hasEvents) {
        const legacyBlocks = savedBlocks ? JSON.parse(savedBlocks) as BusyBlock[] : [];
        if (legacyBlocks.length > 0) {
          const migratedEvents = migrateBlocksToEvents(legacyBlocks);
          dispatch({ type: 'SET_EVENTS', events: migratedEvents });
        }
      }
```

**Step 3: Verify tests still pass**

Run: `npx jest 2>&1 | tail -10`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: auto-migrate legacy blocks to events on first load"
```

---

### Task 8: End-to-end verification and cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npx jest --verbose 2>&1 | tail -30`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing ones)

**Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Manual smoke test**

Start the dev server and verify:
1. `/me` page loads with the grid
2. "Add event" button opens the modal
3. Creating an event adds it to the grid with title visible
4. Editing an event updates it
5. Privacy selector works (visual confirmation)
6. Existing recurring events still display correctly

**Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup and verification"
```
