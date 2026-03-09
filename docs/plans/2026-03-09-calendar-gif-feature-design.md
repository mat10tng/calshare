# Calendar GIF Feature Design

**Date:** 2026-03-09
**Status:** Approved

## Overview

Add a fun, playful layer to the availability grid: each imported calendar can be tagged with a category, and a cat-themed GIF is automatically placed inside the largest sufficiently-large busy region on the grid.

This also lays the groundwork for per-calendar color-coded blocks.

---

## Data Model

### New types

```ts
export type CalendarCategory =
  | 'work'
  | 'personal'
  | 'fitness'
  | 'school'
  | 'family'
  | 'social';

export interface CalendarSource {
  id: string;                        // uuid, generated at import time
  label: string;                     // "Google Calendar", "work.ics", etc.
  category: CalendarCategory | null; // null = user skipped
  addedAt: string;                   // ISO timestamp
}
```

### BusyBlock change

Add optional `sourceId: string` to `BusyBlock` — links each block back to its `CalendarSource`.

```ts
export interface BusyBlock {
  start: string;
  end: string;
  busy: boolean;
  allDay: boolean;
  title?: string;
  sourceId?: string; // NEW — links to CalendarSource.id
}
```

### AppContext state change

Add `sources: CalendarSource[]` to the app state.

---

## Connect Page — Category Picker

### Flow

After an import resolves (Google OAuth callback, Microsoft OAuth, or ICS upload) but **before** the `AnonymisationPreview` modal opens, show an inline category picker step.

### UI

```
┌─────────────────────────────────────┐
│  What kind of calendar is this?     │
│                                     │
│  [💼 Work] [🙂 Personal] [🏋 Fitness] │
│  [📚 School] [👨‍👩‍👧 Family] [🎉 Social] │
│                                     │
│              [Skip / Continue →]    │
└─────────────────────────────────────┘
```

- Button label is **"Skip"** when nothing is selected, **"Continue →"** when a category is picked
- Selecting a category is optional — skipping sets `category: null`
- The selected category is passed into `AnonymisationPreview` and dispatched with the blocks

---

## GIF Catalog

All GIFs are cat-themed. Static files stored in `/public/gifs/`.

| Category | Concept | Filename |
|----------|---------|----------|
| Work | Cat aggressively typing on keyboard | `cat-work.gif` |
| Personal | Cat lounging / napping | `cat-personal.gif` |
| Fitness | Cat doing stretches / yoga | `cat-fitness.gif` |
| School | Cat with glasses reading a book | `cat-school.gif` |
| Family | Group of cats cuddling | `cat-family.gif` |
| Social | Cat partying / wearing a party hat | `cat-social.gif` |

A `gif-catalog.ts` config maps `CalendarCategory → { file: string, label: string }`.

---

## GIF Placement Algorithm

### Goal

Find a 2D rectangle of consecutive busy cells on the grid that is large enough to display a GIF comfortably, and render the cat GIF centered inside it.

### Thresholds

- Minimum width: **2 columns** (days)
- Minimum height: **3 rows** (hours)

### Algorithm (per calendar source)

1. Build a 2D boolean matrix `busy[row][col]` from the source's blocks, filtered to the visible grid range
2. Scan for all rectangles of busy cells meeting minimum dimensions
3. Pick the **largest** qualifying rectangle (area = width × height)
4. Render the GIF as an `absolute`-positioned overlay centered in that region

### Rendering

- The `AvailabilityGrid` component gets a `ref` on the `<table>` element
- After layout, measure actual pixel positions of cells using `getBoundingClientRect()` or computed row/column sizes
- Render GIF `<img>` in a sibling `div` with `position: absolute`, `overflow: hidden`, centered via flexbox inside the measured region
- One GIF per calendar source — if no qualifying rectangle exists, no GIF is shown

---

## Future Extensibility

- `sourceId` on `BusyBlock` enables per-calendar **color-coded blocks** later
- `CalendarSource` is where a `color` field would be added
- The category picker UI can be extended with a color picker in the same step

---

## File Checklist

- `src/types/index.ts` — add `CalendarCategory`, `CalendarSource`, update `BusyBlock`
- `src/context/AppContext.tsx` — add `sources` to state, add dispatch actions
- `src/lib/gif-catalog.ts` — new file, category → GIF mapping
- `src/app/availability/connect/page.tsx` — add category picker step before preview modal
- `src/components/AnonymisationPreview.tsx` — accept and pass through `category`
- `src/components/AvailabilityGrid.tsx` — add GIF overlay rendering with placement algorithm
- `public/gifs/` — 6 cat GIF files (hand-picked by user)
