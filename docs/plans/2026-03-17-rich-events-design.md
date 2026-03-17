# Rich Events Design

**Date:** 2026-03-17
**Status:** Approved
**Approach:** Event Layer on Top (add CalendarEvent alongside existing BusyBlock)

## Goal

Upgrade CalShare from anonymous busy/free blocks to a proper event system with titles, exact times, descriptions, and per-event granular privacy controls. Keep the ephemeral no-account model. Build incrementally on existing infrastructure.

## Data Model

### New type: CalendarEvent

```typescript
export type EventPrivacy = 'full' | 'title-only' | 'busy-only';

export interface CalendarEvent {
  id: string;                    // uuid
  title: string;                 // "Team standup", "Dentist", etc.
  description?: string;          // optional notes (never sent to backend)
  start: string;                 // ISO 8601 UTC (exact time)
  end: string;                   // ISO 8601 UTC (exact time)
  busy: boolean;                 // true = busy, false = free/available
  allDay: boolean;
  privacy: EventPrivacy;         // controls what others see
  source: 'manual' | 'google' | 'outlook' | 'ics' | 'recurring';
  sourceId?: string;             // links to CalendarSource.id or recurring event
  color?: string;                // optional visual color
}
```

### Relationship to BusyBlock

- `BusyBlock` stays as-is — it becomes the **wire format** for Redis and group sharing
- `CalendarEvent` is the **local source of truth** in localStorage
- Sync converts events to blocks with privacy filtering applied
- Backend never stores more than the user chose to share

### Privacy Filtering (event → block conversion)

| Privacy Level | BusyBlock output |
|---------------|-----------------|
| `full` | `{ title, busy, start, end, allDay, sourceId }` |
| `title-only` | `{ title, busy, start, end, allDay, sourceId }` |
| `busy-only` | `{ busy, start, end, allDay }` (no title) |

Note: `description` is **never** sent to the backend regardless of privacy level.

### Migration

Existing `BusyBlock` data in localStorage auto-migrates to `CalendarEvent` with `privacy: 'busy-only'` and source inferred from `sourceId`.

## Event Creation UI

### Flow

1. User clicks a cell on the grid OR clicks an "Add Event" button on `/me`
2. A modal opens with:
   - **Title** (required) — text input
   - **Date** — pre-filled from clicked cell or date picker
   - **Start/End time** — time pickers (any minute, not grid-snapped)
   - **All day** toggle
   - **Busy/Free** toggle (defaults to busy)
   - **Privacy** — three-way selector: "Share everything" / "Title only" / "Busy only" (defaults to "Busy only")
   - **Description** (optional) — textarea
3. Save creates a `CalendarEvent` in state, renders on grid, syncs to backend

### Grid Rendering Changes

- Events with titles show a small label inside the grid cell (truncated)
- Events spanning sub-hour times show precise start/end indicators (half-filled cell for 9:30-10:00)
- Privacy level indicated by a small icon (lock for busy-only, eye for full)
- Clicking an existing event opens the modal in edit mode

### Editing Rules

- **Manually created events:** fully editable (title, time, privacy, description)
- **Imported events (Google/Outlook/ICS):** only **privacy level** can be changed (time/title come from source)

## State Management

### AppContext Changes

New state field:
```typescript
events: CalendarEvent[];  // local source of truth
```

New actions:
```typescript
| { type: 'SET_EVENTS'; events: CalendarEvent[] }
| { type: 'ADD_EVENT'; event: CalendarEvent }
| { type: 'UPDATE_EVENT'; id: string; changes: Partial<CalendarEvent> }
| { type: 'REMOVE_EVENT'; id: string }
| { type: 'IMPORT_EVENTS'; source: CalendarSource; events: CalendarEvent[] }
```

### localStorage

New key: `calshare:events` stores `CalendarEvent[]`.

On hydration: if `calshare:events` doesn't exist but `calshare:blocks` does, auto-migrate.

### Sync Pipeline

Before: `blocks + recurringExpanded → syncBlocksToBackend()`
After: `events → applyPrivacyFilter() → BusyBlock[] → syncBlocksToBackend()`

RecurringEvent gets folded into CalendarEvent system (recurring events generate CalendarEvent entries with `source: 'recurring'`).

### Backward Compatibility

The `blocks` field stays in AppState as a derived computed value from events. Existing components that read `state.blocks` continue to work.

## File Changes

### Modified files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `CalendarEvent`, `EventPrivacy` types |
| `src/context/AppContext.tsx` | Add `events` state, new actions, privacy filter in sync, migration logic |
| `src/components/AvailabilityGrid.tsx` | Render event titles on grid cells, sub-hour indicators, click-to-edit |
| `src/app/me/page.tsx` | Add "Add Event" button, event creation modal |
| `src/lib/anonymise.ts` | Update to work with privacy-filtered BusyBlock output |

### New files

| File | Purpose |
|------|---------|
| `src/components/EventModal.tsx` | Create/edit event modal with title, time, privacy controls |
| `src/lib/events.ts` | Privacy filtering, block migration, event-to-block conversion |

### Unchanged

API routes, Redis storage, group session logic, proposals, merge logic — all continue to work with BusyBlock on the wire.

## Key Design Decisions

1. **Privacy-first defaults:** New events default to `busy-only`. Imported events inherit `busy-only`.
2. **Description stays local:** Never transmitted, even at `full` privacy.
3. **Hourly grid, exact times:** Grid display stays hourly for overview; events store exact ISO timestamps internally.
4. **No backend schema changes:** The wire format (BusyBlock) is unchanged. Only the client-side data model evolves.
5. **Incremental migration:** Old data auto-migrates. No breaking changes for existing sessions.
