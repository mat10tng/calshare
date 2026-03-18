# Event Mode Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Event mode" toggle on the /me page that opens EventModal after grid drag, pre-filled with the selected time range.

**Architecture:** Add `eventModeEnabled` to `UserPreferences` (persisted via existing localStorage pipeline). On the /me page, intercept `onBlocksChange` when event mode is on — diff new blocks against old to find the dragged range, then open EventModal pre-filled. Cancel reverts; save creates a CalendarEvent.

**Tech Stack:** React, Next.js, TypeScript, existing AppContext state management

---

### Task 1: Add `eventModeEnabled` to UserPreferences type

**Files:**
- Modify: `src/types/index.ts:45-52`

**Step 1: Add the field**

Add `eventModeEnabled?: boolean;` to the `UserPreferences` interface:

```typescript
export interface UserPreferences {
  workingHours: {
    [day in Weekday]?: { start: string; end: string } | null;
  };
  blockedWindows: { start: string; end: string; recurrence: RecurrenceRule }[];
  bufferMinutes: number;
  lookAheadDays: number;
  eventModeEnabled?: boolean;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add eventModeEnabled to UserPreferences type"
```

---

### Task 2: Add `eventModeEnabled` default to AppContext

**Files:**
- Modify: `src/context/AppContext.tsx:32-45`

**Step 1: Add default**

Add `eventModeEnabled: false` to `DEFAULT_PREFS`:

```typescript
const DEFAULT_PREFS: UserPreferences = {
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
  bufferMinutes: 15,
  lookAheadDays: 14,
  eventModeEnabled: false,
};
```

**Step 2: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add eventModeEnabled default to DEFAULT_PREFS"
```

---

### Task 3: Add EventModal `defaultEndHour` prop

**Files:**
- Modify: `src/components/EventModal.tsx:5-8,33-35`

**Step 1: Add prop to interface**

```typescript
interface Props {
  event?: CalendarEvent;
  defaultDate?: string;   // YYYY-MM-DD
  defaultHour?: number;   // 0-23
  defaultEndHour?: number; // 0-23
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
}
```

**Step 2: Use prop in component**

Update the function signature and `initEndHour` logic:

```typescript
export function EventModal({ event, defaultDate, defaultHour, defaultEndHour, onSave, onCancel }: Props) {
```

Change `initEndHour`:

```typescript
  const initEndHour = event
    ? new Date(event.end).getUTCHours()
    : (defaultEndHour ?? Math.min((defaultHour ?? 9) + 1, 23));
```

**Step 3: Commit**

```bash
git add src/components/EventModal.tsx
git commit -m "feat: add defaultEndHour prop to EventModal"
```

---

### Task 4: Wire up event mode toggle + drag-to-modal on /me page

**Files:**
- Modify: `src/app/me/page.tsx`

**Step 1: Add state for end hour and block snapshot**

After line 38 (`const [createFromHour, ...]`), add:

```typescript
const [createFromEndHour, setCreateFromEndHour] = useState<number | undefined>(undefined);
const [blocksBeforeDrag, setBlocksBeforeDrag] = useState<BusyBlock[] | null>(null);
```

**Step 2: Add toggle UI**

After the "+ Add event" button (line 241), add a toggle:

```typescript
{/* Event mode toggle */}
<label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--subtle)' }}>
  <input
    type="checkbox"
    checked={state.preferences.eventModeEnabled ?? false}
    onChange={(e) => dispatch({
      type: 'SET_PREFERENCES',
      preferences: { ...state.preferences, eventModeEnabled: e.target.checked },
    })}
    style={{ accentColor: 'var(--accent)' }}
  />
  Event mode
</label>
```

**Step 3: Modify `onBlocksChange` to intercept when event mode is on**

Replace the current `onBlocksChange` callback (lines 264-268) with:

```typescript
onBlocksChange={(newBlocks) => {
  // Filter out recurring-sourced and event-sourced blocks
  const manual = newBlocks.filter(b => !b.sourceId?.startsWith('recurring:'));

  if (state.preferences.eventModeEnabled) {
    // Find newly added blocks by comparing with current state
    const oldKeys = new Set(state.blocks.map(b => `${b.start}|${b.end}`));
    const added = manual.filter(b => !oldKeys.has(`${b.start}|${b.end}`));

    if (added.length > 0) {
      // Save current blocks so we can revert on cancel
      setBlocksBeforeDrag(state.blocks);

      // Find the date and hour range from the new blocks
      const starts = added.map(b => new Date(b.start));
      const ends = added.map(b => new Date(b.end));
      const earliest = new Date(Math.min(...starts.map(d => d.getTime())));
      const latest = new Date(Math.max(...ends.map(d => d.getTime())));

      setCreateFromDate(earliest.toISOString().split('T')[0]);
      setCreateFromHour(earliest.getUTCHours());
      setCreateFromEndHour(latest.getUTCHours());

      // Don't persist the blocks yet — wait for modal save/cancel
      return;
    }
  }

  dispatch({ type: 'SET_BLOCKS', blocks: manual });
}}
```

**Step 4: Update `handleCancelEvent` to revert blocks**

```typescript
function handleCancelEvent() {
  if (blocksBeforeDrag !== null) {
    // Revert blocks to before the drag (event mode cancel)
    dispatch({ type: 'SET_BLOCKS', blocks: blocksBeforeDrag });
    setBlocksBeforeDrag(null);
  }
  setEditingEvent(null);
  setCreateFromDate(null);
  setCreateFromHour(undefined);
  setCreateFromEndHour(undefined);
}
```

**Step 5: Update `handleSaveEvent` to clean up**

```typescript
function handleSaveEvent(event: CalendarEvent) {
  if (editingEvent) {
    dispatch({ type: 'UPDATE_EVENT', id: editingEvent.id, changes: event });
  } else {
    dispatch({ type: 'ADD_EVENT', event });
  }
  // If we came from event mode drag, restore blocks (don't keep the raw block)
  if (blocksBeforeDrag !== null) {
    dispatch({ type: 'SET_BLOCKS', blocks: blocksBeforeDrag });
    setBlocksBeforeDrag(null);
  }
  setEditingEvent(null);
  setCreateFromDate(null);
  setCreateFromHour(undefined);
  setCreateFromEndHour(undefined);
}
```

**Step 6: Pass `defaultEndHour` to EventModal**

Update the EventModal render (lines 410-418):

```typescript
{showEventModal && (
  <EventModal
    event={editingEvent ?? undefined}
    defaultDate={createFromDate ?? undefined}
    defaultHour={createFromHour}
    defaultEndHour={createFromEndHour}
    onSave={handleSaveEvent}
    onCancel={handleCancelEvent}
  />
)}
```

**Step 7: Commit**

```bash
git add src/app/me/page.tsx
git commit -m "feat: wire up event mode toggle with drag-to-modal flow"
```

---

### Task 5: Manual testing

**Step 1: Start dev server and test**

Run: `npm run dev`

Test these scenarios:
1. Toggle OFF (default): drag on grid creates blocks as before — no modal
2. Toggle ON: drag on grid → modal opens with correct date/time range
3. Toggle ON + cancel modal: block is removed, grid returns to previous state
4. Toggle ON + save modal: event is created with title, block is not duplicated
5. Toggle persists across page reload (check localStorage `calshare:preferences`)
6. "+ Add event" button still works regardless of toggle state
