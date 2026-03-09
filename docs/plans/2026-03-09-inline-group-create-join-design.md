# Inline Group Create / Join — Availability Tab

**Date:** 2026-03-09
**Status:** Approved

## Summary

Add inline "Create a new group" and "Join a group" forms directly under the availability grid on the availability tab. A list of all groups the user belongs to appears below these forms.

## Motivation

Currently both actions navigate away to separate pages (`/sessions/new`, `/sessions/[id]/join`). Users should be able to create or join a group without leaving their availability view.

## Layout

```
[ Your Availability ]
...AvailabilityGrid...

[+ Create a new group]  [Join a group]

▼ when "Create" is active:
  Group name (optional): [_____________]
  People needed: [2]
  [Create session]  [Cancel]

▼ when "Join" is active:
  Paste join link or session ID: [_____]
  [Join]  [Cancel]

Your Groups
• Team standup   organizer   Open | Copy link | Rename | Leave
• Friday lunch   participant Open | Copy link | Rename | Leave
```

The toggle buttons are shown in both the empty-state and the populated-state views.

## Component Changes

### `src/app/availability/page.tsx`

- Add `activePanel` state: `null | 'create' | 'join'`
- Add `createGroupName`, `createQuorum`, `joinInput` form states
- Add `handleCreate()` — ported from `sessions/new/page.tsx`:
  1. `POST /api/sessions` with quorum + lookAheadDays
  2. `dispatch ADD_GROUP` (role: organizer)
  3. `dispatch SET_ORGANIZER_TOKEN`
  4. `POST /api/sessions/:id/participants` with current blocks
  5. Set `activePanel` to null on success
- Add `handleJoin(input)` — new logic:
  1. Extract session ID from pasted URL or raw ID
  2. `POST /api/sessions/:id/participants` with blocks
  3. `dispatch ADD_GROUP` (role: participant)
  4. Set `activePanel` to null on success
- Remove standalone `"Plan with a group"` link button (replaced by inline forms)
- Render `<GroupsList>` immediately below the create/join section (replaces bottom-of-page placement)

### `src/components/GroupsList.tsx`

- Remove the `+ New group` header button (redundant; action now lives above)
- Keep all existing per-group actions: Open, Copy link, Rename, Leave

## Join Input Parsing

Accept both:
- Full URL: `https://example.com/sessions/ABC123/join` → extract `ABC123`
- Raw session ID: `ABC123`

Simple regex: extract the path segment before `/join` if present, otherwise treat the whole trimmed string as the ID.

## Error Handling

- Create: show inline error below form on API failure
- Join: show inline error if session ID not found or API rejects

## Out of Scope

- The `/sessions/new` page is not removed (still reachable via direct URL / existing links)
- No changes to session API routes
