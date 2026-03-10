# Calendar GIF Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Tag each imported calendar with a category, then render a cat GIF inside the largest 2D busy-block rectangle on the availability grid for that calendar.

**Architecture:** Per-calendar `CalendarSource` objects live in AppContext state alongside `BusyBlock[]`s that carry a `sourceId`. The connect page adds a category picker step between import and the anonymisation preview. `AvailabilityGrid` scans for the largest contiguous rectangle of busy cells (≥ 2 cols wide × ≥ 3 rows tall) per source and absolutely-positions a cat GIF inside it.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Jest + ts-jest

---

## Task 1: Update types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types to `src/types/index.ts`**

Replace the existing content with:

```ts
export interface BusyBlock {
  start: string;   // ISO 8601 UTC
  end: string;     // ISO 8601 UTC
  busy: boolean;
  allDay: boolean;
  title?: string;  // optional — only included when user opts in
  sourceId?: string; // links to CalendarSource.id
}

export type CalendarCategory =
  | 'work'
  | 'personal'
  | 'fitness'
  | 'school'
  | 'family'
  | 'social';

export interface CalendarSource {
  id: string;                        // uuid generated at import time
  label: string;                     // "Google Calendar", "work.ics", etc.
  category: CalendarCategory | null; // null = user skipped
  addedAt: string;                   // ISO timestamp
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'none';

export interface UserPreferences {
  workingHours: {
    [day in Weekday]?: { start: string; end: string } | null;
  };
  blockedWindows: { start: string; end: string; recurrence: RecurrenceRule }[];
  bufferMinutes: number;
  lookAheadDays: number;
}

export interface Session {
  sessionId: string;
  organizerToken: string;
  quorum: number;
  lookAheadDays: number;
  createdAt: string;
  participants: {
    [participantId: string]: BusyBlock[];
  };
}

export type IngestionPath = 'oauth-google' | 'oauth-microsoft' | 'ics-upload' | 'ics-guide';
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/tuan/Documents/Git/CalendarSharing
npx tsc --noEmit
```

Expected: no errors (or same pre-existing errors as before — none new).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add CalendarSource and CalendarCategory types, add sourceId to BusyBlock"
```

---

## Task 2: Update AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add `sources` to state and `IMPORT_CALENDAR` action**

Replace `src/context/AppContext.tsx` with:

```ts
'use client';
import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react';
import type { BusyBlock, CalendarSource, UserPreferences } from '@/types';

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
};

interface AppState {
  blocks: BusyBlock[];
  sources: CalendarSource[];
  preferences: UserPreferences;
  sessionId: string | null;
  organizerToken: string | null;
}

type Action =
  | { type: 'IMPORT_CALENDAR'; source: CalendarSource; blocks: BusyBlock[] }
  | { type: 'SET_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'ADD_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'CLEAR_BLOCKS' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'IMPORT_CALENDAR':
      return {
        ...state,
        sources: [...state.sources, action.source],
        blocks: [...state.blocks, ...action.blocks],
      };
    case 'SET_BLOCKS':
      return { ...state, blocks: action.blocks };
    case 'ADD_BLOCKS':
      return { ...state, blocks: [...state.blocks, ...action.blocks] };
    case 'CLEAR_BLOCKS':
      return { ...state, blocks: [], sources: [] };
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.preferences };
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId, organizerToken: action.organizerToken };
    case 'CLEAR_SESSION':
      return { ...state, sessionId: null, organizerToken: null };
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  blocks: [],
  sources: [],
  preferences: DEFAULT_PREFS,
  sessionId: null,
  organizerToken: null,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('calshare:preferences');
      if (savedPrefs) {
        dispatch({ type: 'SET_PREFERENCES', preferences: JSON.parse(savedPrefs) });
      }
      const savedBlocks = localStorage.getItem('calshare:blocks');
      if (savedBlocks) {
        dispatch({ type: 'SET_BLOCKS', blocks: JSON.parse(savedBlocks) });
      }
      const savedSessionId = localStorage.getItem('calshare:sessionId');
      const savedOrganizerToken = localStorage.getItem('calshare:organizerToken');
      if (savedSessionId && savedOrganizerToken) {
        dispatch({ type: 'SET_SESSION', sessionId: savedSessionId, organizerToken: savedOrganizerToken });
      }
    } catch {
      // localStorage unavailable or invalid JSON — use defaults
    }
    setHydrated(true);
  }, []);

  // Persist state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('calshare:preferences', JSON.stringify(state.preferences));
    } catch { /* ignore */ }
  }, [state.preferences]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:blocks', JSON.stringify(state.blocks));
    } catch { /* ignore */ }
  }, [state.blocks]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:sources', JSON.stringify(state.sources));
    } catch { /* ignore */ }
  }, [state.sources]);

  useEffect(() => {
    try {
      if (state.sessionId && state.organizerToken) {
        localStorage.setItem('calshare:sessionId', state.sessionId);
        localStorage.setItem('calshare:organizerToken', state.organizerToken);
      } else {
        localStorage.removeItem('calshare:sessionId');
        localStorage.removeItem('calshare:organizerToken');
      }
    } catch { /* ignore */ }
  }, [state.sessionId, state.organizerToken]);

  return (
    <AppContext.Provider value={{ state, dispatch, hydrated }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): { state: AppState; dispatch: React.Dispatch<Action>; hydrated: boolean } {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { DEFAULT_PREFS };
```

Note: `sources` is also loaded from localStorage in the hydration `useEffect` — add this line after `savedBlocks` is loaded:

```ts
const savedSources = localStorage.getItem('calshare:sources');
if (savedSources) {
  // We don't have a SET_SOURCES action — instead we'll handle this via IMPORT_CALENDAR
  // Sources are re-derived on startup from localStorage directly.
  // For now, store them in a ref and set via a future SET_SOURCES action if needed.
}
```

Actually — sources are stored separately but the reducer doesn't have `SET_SOURCES`. Simplest fix: add it.

In the `Action` type, add:
```ts
| { type: 'SET_SOURCES'; sources: CalendarSource[] }
```

In the reducer `switch`, add:
```ts
case 'SET_SOURCES':
  return { ...state, sources: action.sources };
```

In the hydration `useEffect`, after loading blocks:
```ts
const savedSources = localStorage.getItem('calshare:sources');
if (savedSources) {
  dispatch({ type: 'SET_SOURCES', sources: JSON.parse(savedSources) });
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add sources to AppContext state with IMPORT_CALENDAR action"
```

---

## Task 3: Create gif-catalog

**Files:**
- Create: `src/lib/gif-catalog.ts`

**Step 1: Write the catalog**

```ts
import type { CalendarCategory } from '@/types';

export interface GifEntry {
  file: string;   // filename under /public/gifs/
  label: string;  // human-readable
  emoji: string;
}

export const GIF_CATALOG: Record<CalendarCategory, GifEntry> = {
  work:     { file: 'cat-work.gif',     label: 'Work',     emoji: '💼' },
  personal: { file: 'cat-personal.gif', label: 'Personal', emoji: '🙂' },
  fitness:  { file: 'cat-fitness.gif',  label: 'Fitness',  emoji: '🏋' },
  school:   { file: 'cat-school.gif',   label: 'School',   emoji: '📚' },
  family:   { file: 'cat-family.gif',   label: 'Family',   emoji: '👨‍👩‍👧' },
  social:   { file: 'cat-social.gif',   label: 'Social',   emoji: '🎉' },
};

export const CATEGORY_OPTIONS: { value: CalendarCategory; label: string; emoji: string }[] = [
  { value: 'work',     label: 'Work',     emoji: '💼' },
  { value: 'personal', label: 'Personal', emoji: '🙂' },
  { value: 'fitness',  label: 'Fitness',  emoji: '🏋' },
  { value: 'school',   label: 'School',   emoji: '📚' },
  { value: 'family',   label: 'Family',   emoji: '👨‍👩‍👧' },
  { value: 'social',   label: 'Social',   emoji: '🎉' },
];
```

**Step 2: Create the `/public/gifs/` directory and add placeholder GIFs**

```bash
mkdir -p /Users/tuan/Documents/Git/CalendarSharing/public/gifs
```

**MANUAL STEP — User action required:** Download or source 6 cat GIFs and place them at:
- `public/gifs/cat-work.gif` — cat aggressively typing on keyboard
- `public/gifs/cat-personal.gif` — cat lounging / napping
- `public/gifs/cat-fitness.gif` — cat doing stretches / yoga
- `public/gifs/cat-school.gif` — cat with glasses reading a book
- `public/gifs/cat-family.gif` — group of cats cuddling
- `public/gifs/cat-social.gif` — cat partying / wearing a party hat

Suggested source: [Giphy](https://giphy.com) — right-click → Save As GIF, or download via their developer tools.

Until real GIFs are added, create a visible placeholder to confirm the overlay renders:

```bash
# Temporary: copy a single test gif for all 6 slots (user replaces later)
# Just create empty files so the img tags don't 404 in an ugly way
touch public/gifs/cat-work.gif public/gifs/cat-personal.gif public/gifs/cat-fitness.gif
touch public/gifs/cat-school.gif public/gifs/cat-family.gif public/gifs/cat-social.gif
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/gif-catalog.ts public/gifs/
git commit -m "feat: add gif catalog config and public/gifs directory"
```

---

## Task 4: Add rectangle-finder algorithm

**Files:**
- Create: `src/lib/gif-placement.ts`
- Create: `src/lib/__tests__/gif-placement.test.ts`

**Step 1: Write the failing test first**

Create `src/lib/__tests__/gif-placement.test.ts`:

```ts
import { findLargestBusyRect } from '@/lib/gif-placement';

describe('findLargestBusyRect', () => {
  // Grid: rows=hours(0-indexed), cols=days(0-indexed)
  // Each cell: true = busy

  test('returns null when no cells are busy', () => {
    const grid = [
      [false, false],
      [false, false],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('returns null when only 1 col wide', () => {
    const grid = [
      [true],
      [true],
      [true],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('returns null when only 1-2 rows tall', () => {
    const grid = [
      [true, true, true],
      [true, true, true],
    ];
    expect(findLargestBusyRect(grid)).toBeNull();
  });

  test('finds a valid rect: 2 cols × 3 rows', () => {
    const grid = [
      [true, true, false],
      [true, true, false],
      [true, true, false],
      [false, false, false],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).not.toBeNull();
    expect(rect!.cols).toBe(2);
    expect(rect!.rows).toBe(3);
  });

  test('picks the largest rectangle when multiple qualify', () => {
    // 2×3 block starting at row 0 col 0, and 3×4 block starting at row 0 col 2
    const grid = [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [false, false, true, true, true],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).not.toBeNull();
    // 3 cols × 4 rows = 12 is larger than 5 cols × 3 rows = 15... actually 5×3=15
    // The largest all-busy rectangle is 5 cols × 3 rows = 15
    expect(rect!.rows).toBe(3);
    expect(rect!.cols).toBe(5);
  });

  test('returns startRow, startCol, rows, cols', () => {
    const grid = [
      [false, false, false],
      [false, true,  true ],
      [false, true,  true ],
      [false, true,  true ],
    ];
    const rect = findLargestBusyRect(grid);
    expect(rect).toEqual({ startRow: 1, startCol: 1, rows: 3, cols: 2 });
  });
});
```

**Step 2: Run the test — expect it to fail (function not found)**

```bash
npx jest src/lib/__tests__/gif-placement.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/lib/gif-placement'"

**Step 3: Implement `findLargestBusyRect`**

Create `src/lib/gif-placement.ts`:

```ts
export interface BusyRect {
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
}

const MIN_COLS = 2;
const MIN_ROWS = 3;

/**
 * Finds the largest axis-aligned rectangle of all-true cells in a 2D boolean
 * grid, subject to minimum dimensions. Uses the maximal-rectangle histogram algorithm.
 *
 * grid[row][col] = true means that cell is busy.
 * Returns null if no qualifying rectangle exists.
 */
export function findLargestBusyRect(grid: boolean[][]): BusyRect | null {
  const numRows = grid.length;
  const numCols = grid[0]?.length ?? 0;
  if (numRows === 0 || numCols === 0) return null;

  // heights[col] = number of consecutive busy rows ending at current row
  const heights = new Array<number>(numCols).fill(0);
  let best: BusyRect | null = null;
  let bestArea = 0;

  for (let r = 0; r < numRows; r++) {
    // Update heights
    for (let c = 0; c < numCols; c++) {
      heights[c] = grid[r][c] ? heights[c] + 1 : 0;
    }

    // Find largest rectangle in this histogram row
    const result = largestRectInHistogram(heights, r);
    if (result && result.area > bestArea) {
      bestArea = result.area;
      best = result.rect;
    }
  }

  if (!best || best.cols < MIN_COLS || best.rows < MIN_ROWS) return null;
  return best;
}

interface HistogramResult {
  area: number;
  rect: BusyRect;
}

function largestRectInHistogram(
  heights: number[],
  bottomRow: number,
): HistogramResult | null {
  const stack: number[] = []; // col indices
  let best: HistogramResult | null = null;

  const process = (i: number) => {
    while (stack.length > 0 && heights[stack[stack.length - 1]] > heights[i]) {
      const h = heights[stack.pop()!];
      const left = stack.length === 0 ? 0 : stack[stack.length - 1] + 1;
      const width = i - left;
      const area = h * width;
      if (!best || area > best.area) {
        best = {
          area,
          rect: {
            startRow: bottomRow - h + 1,
            startCol: left,
            rows: h,
            cols: width,
          },
        };
      }
    }
    stack.push(i);
  };

  for (let i = 0; i <= heights.length; i++) {
    process(i);
  }

  return best;
}
```

**Step 4: Run the tests — expect them to pass**

```bash
npx jest src/lib/__tests__/gif-placement.test.ts --no-coverage
```

Expected: all 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/gif-placement.ts src/lib/__tests__/gif-placement.test.ts
git commit -m "feat: add findLargestBusyRect algorithm with tests"
```

---

## Task 5: Category picker on connect page

**Files:**
- Modify: `src/app/availability/connect/page.tsx`

**Step 1: Add category picker state and UI**

In `connect/page.tsx`, make these changes:

1. Add imports at the top:
```ts
import { CATEGORY_OPTIONS } from '@/lib/gif-catalog';
import type { CalendarCategory } from '@/types';
```

2. Add state after the existing `useState` declarations:
```ts
// undefined = not yet picked, null = user skipped, CalendarCategory = chosen
const [pendingCategory, setPendingCategory] = useState<CalendarCategory | null | undefined>(undefined);
```

3. Replace `handleConfirm` and the bottom of the component. The new flow:
   - When `pending` is set and `pendingCategory === undefined` → show category picker
   - When `pendingCategory !== undefined` → show `AnonymisationPreview`
   - `handleConfirm` dispatches `IMPORT_CALENDAR` instead of `ADD_BLOCKS`

Add the new `handleConfirm`:
```ts
function handleConfirm(blocks: BusyBlock[]) {
  const source: import('@/types').CalendarSource = {
    id: crypto.randomUUID(),
    label: pending!.source,
    category: pendingCategory ?? null,
    addedAt: new Date().toISOString(),
  };
  // Tag each block with this source id
  const taggedBlocks = blocks.map((b) => ({ ...b, sourceId: source.id }));
  dispatch({ type: 'IMPORT_CALENDAR', source, blocks: taggedBlocks });
  setPending(null);
  setPendingCategory(undefined);
  router.push('/availability');
}

function handleCancel() {
  setPending(null);
  setPendingCategory(undefined);
}
```

4. In the JSX, replace the `{pending && <AnonymisationPreview ...>}` block with:

```tsx
{pending && pendingCategory === undefined && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
      <h2 className="text-lg font-semibold mb-1">What kind of calendar is this?</h2>
      <p className="text-sm text-gray-500 mb-5">{pending.source}</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPendingCategory(opt.value)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors ${
              pendingCategory === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => setPendingCategory(pendingCategory ?? null)}
          className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {pendingCategory !== undefined && pendingCategory !== null ? 'Continue →' : 'Skip'}
        </button>
      </div>
    </div>
  </div>
)}

{pending && pendingCategory !== undefined && (
  <AnonymisationPreview
    blocks={pending.blocks}
    source={pending.source}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
)}
```

Note: The "Skip" button sets `pendingCategory` to `null` (which is `!== undefined`), advancing to `AnonymisationPreview`. When a category button is clicked, `setPendingCategory(opt.value)` is called, visually selecting it. The single Continue/Skip button then advances.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Start dev server and manually test the flow**

```bash
npm run dev
```

1. Go to `/availability/connect`
2. Upload any `.ics` file (or use Google OAuth)
3. Verify the category picker modal appears
4. Click a category → button should change to "Continue →"
5. Click Continue → `AnonymisationPreview` should appear
6. Confirm import → redirected to `/availability`
7. Repeat but click Skip → goes straight to `AnonymisationPreview`

**Step 4: Commit**

```bash
git add src/app/availability/connect/page.tsx
git commit -m "feat: add calendar category picker step to import flow"
```

---

## Task 6: GIF overlay in AvailabilityGrid

**Files:**
- Modify: `src/components/AvailabilityGrid.tsx`

**Step 1: Add props and imports**

Add to the top of `AvailabilityGrid.tsx`:

```ts
import type { CalendarSource } from '@/types';
import { GIF_CATALOG } from '@/lib/gif-catalog';
import { findLargestBusyRect } from '@/lib/gif-placement';
import Image from 'next/image';
```

Update the `Props` interface:

```ts
interface Props {
  blocks: BusyBlock[];
  sources?: CalendarSource[];   // NEW
  fromDate: string;
  toDate: string;
  onBlocksChange?: (blocks: BusyBlock[]) => void;
}
```

**Step 2: Add GIF computation inside the component**

Add this inside `AvailabilityGrid`, after the existing `useState`/`useRef` setup:

```ts
const tableRef = useRef<HTMLTableElement>(null);

// Compute GIF placements: one per source that has a category
const gifPlacements = useMemo(() => {
  if (!sources?.length) return [];
  const results: { source: CalendarSource; rect: import('@/lib/gif-placement').BusyRect }[] = [];

  for (const source of sources) {
    if (!source.category) continue;

    // Build 2D busy grid for this source's blocks only
    const sourceBlocks = blocks.filter((b) => b.busy && b.sourceId === source.id);
    const grid: boolean[][] = HOURS.map((hour) =>
      dates.map((date) => {
        const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
        const slotEnd = new Date(slotStart.getTime() + 3_600_000);
        return sourceBlocks.some(
          (b) => new Date(b.start) < slotEnd && new Date(b.end) > slotStart,
        );
      }),
    );

    const rect = findLargestBusyRect(grid);
    if (rect) results.push({ source, rect });
  }

  return results;
}, [blocks, sources, dates]);
```

Add `useMemo` to the import at the top:
```ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
```

**Step 3: Render GIF overlays**

Wrap the existing `<div className="overflow-x-auto">` in a `relative` wrapper and add overlays after the table:

```tsx
return (
  <div className="relative">
    <div className="overflow-x-auto">
      <table
        ref={tableRef}
        className={`text-xs border-collapse min-w-full ${drag ? 'select-none' : ''}`}
        onMouseLeave={() => { if (!drag) setHovered(null); }}
      >
        {/* ... existing thead/tbody unchanged ... */}
      </table>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        {/* ... existing legend unchanged ... */}
      </div>
    </div>

    {/* GIF overlays */}
    {gifPlacements.map(({ source, rect }) => {
      if (!source.category) return null;
      const entry = GIF_CATALOG[source.category];

      // Fixed cell dimensions (must match Tailwind classes used in the grid)
      const ROW_HEIGHT = 16;   // h-4 = 16px
      const COL_WIDTH = 36;    // min-w-[36px]
      const HEADER_ROW = 28;   // approximate thead height (py-1 + text)
      const TIME_COL = 48;     // w-12 = 48px

      const top = HEADER_ROW + rect.startRow * ROW_HEIGHT;
      const left = TIME_COL + rect.startCol * COL_WIDTH;
      const width = rect.cols * COL_WIDTH;
      const height = rect.rows * ROW_HEIGHT;

      return (
        <div
          key={source.id}
          className="absolute pointer-events-none overflow-hidden flex items-center justify-center"
          style={{ top, left, width, height }}
        >
          <Image
            src={`/gifs/${entry.file}`}
            alt={`${entry.label} calendar`}
            width={width}
            height={height}
            className="object-cover opacity-60 rounded"
            unoptimized
          />
        </div>
      );
    })}
  </div>
);
```

**Step 4: Pass `sources` from the availability page**

In `src/app/availability/page.tsx`, update the `<AvailabilityGrid>` usage:

```tsx
<AvailabilityGrid
  blocks={state.blocks}
  sources={state.sources}
  fromDate={now}
  toDate={until}
  onBlocksChange={(newBlocks) => dispatch({ type: 'SET_BLOCKS', blocks: newBlocks })}
/>
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Start dev server and manually test**

```bash
npm run dev
```

1. Import a calendar and pick a category (e.g., Work)
2. Navigate to `/availability`
3. Verify a cat GIF appears inside the largest 2D busy block region
4. The GIF should only appear if there's a block ≥ 2 days wide × ≥ 3 hours tall
5. If no qualifying region, no GIF (import a sparser calendar to test this)
6. Import a second calendar with a different category — verify two GIFs appear for two qualifying regions

**Step 7: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

**Step 8: Commit**

```bash
git add src/components/AvailabilityGrid.tsx src/app/availability/page.tsx
git commit -m "feat: render cat GIF inside largest 2D busy block region per calendar source"
```

---

## Task 7: Final integration check and GIF files

**Step 1: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

**Step 2: Build check**

```bash
npm run build
```

Expected: clean build, no type errors.

**Step 3: Replace placeholder GIFs with real ones (manual)**

The user adds 6 real cat GIFs to `public/gifs/`:
- `cat-work.gif`, `cat-personal.gif`, `cat-fitness.gif`
- `cat-school.gif`, `cat-family.gif`, `cat-social.gif`

Suggested sources: Giphy, Tenor (download directly without API).

**Step 4: Final commit**

```bash
git add public/gifs/
git commit -m "feat: add cat GIF assets for calendar categories"
```

---

## Notes

- The pixel math in Task 6 Step 3 uses fixed values that match the Tailwind classes (`h-4`, `min-w-[36px]`, `w-12`). If those classes ever change, update the constants.
- `unoptimized` on the `<Image>` tag is required for animated GIFs (Next.js image optimization breaks animation).
- The `opacity-60` makes the GIF feel like a background layer rather than foreground. Adjust if needed.
- Future: add a `color` field to `CalendarSource` and use `sourceId` to color-code blocks in the grid.
