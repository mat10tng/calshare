# Event Mode Toggle Design

**Date:** 2026-03-18
**Status:** Approved

## Problem

Dragging on the calendar grid creates busy blocks without titles. To create a titled event, users must use the separate "+ Add event" button. There's no way to drag a time range and immediately add event details.

## Solution

Add an "Event mode" toggle on the /me page. When enabled, completing a grid drag opens the EventModal pre-filled with the selected time range, allowing the user to add a title and other details. Cancelling the modal discards the block.

## Design

### 1. UserPreferences

Add `eventModeEnabled: boolean` to `UserPreferences` interface and `DEFAULT_PREFS` (default: `false`). Persisted via existing `calshare:preferences` localStorage key.

### 2. Toggle UI

A labeled checkbox on the /me page near the "+ Add event" button:
- Label: "Event mode"
- Sublabel: "Opens event details after selecting time"
- Updates preferences via `SET_PREFERENCES` dispatch

### 3. Drag behavior (toggle ON)

1. Grid drag completes → `onBlocksChange` fires with new blocks array
2. /me page diffs new blocks vs previous to find the newly added range
3. Sets `createFromDate`, `createFromHour`, and new `createFromEndHour` state
4. EventModal opens pre-filled with date and time range
5. **Save** → `ADD_EVENT` dispatched, block not persisted (event replaces it)
6. **Cancel** → blocks reverted to previous state, nothing saved

### 4. Files changed

- `src/types/index.ts` — add `eventModeEnabled` to `UserPreferences`
- `src/context/AppContext.tsx` — add to `DEFAULT_PREFS`
- `src/app/me/page.tsx` — toggle UI, modified `onBlocksChange`, end-hour state
- `src/components/EventModal.tsx` — accept optional `defaultEndHour` prop
