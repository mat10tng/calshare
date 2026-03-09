# Groups Feature Design

**Date:** 2026-03-09
**Status:** Approved

## Overview

Allow users to track multiple group sessions they've created or joined. Groups appear in a list directly below the availability grid on `/availability`. Any user can name or rename a group locally at any time. Block changes auto-sync to all joined groups.

## Data Model (localStorage)

### `calshare:groups` — `GroupEntry[]`

```ts
interface GroupEntry {
  sessionId: string;
  role: 'organizer' | 'participant';
  participantId?: string;   // participants only — used for block updates
  name: string;             // user's local label, editable anytime
  joinedAt: string;         // ISO timestamp
}
```

### `calshare:organizerTokens` — `Record<string, string>`

Maps `sessionId → organizerToken` for each group where the user is organizer. Decouples multi-group support from the single `sessionId/organizerToken` in AppState (which remains for the personal availability session).

## AppContext Changes

- Add `groups: GroupEntry[]` and `organizerTokens: Record<string, string>` to `AppState`
- New actions: `ADD_GROUP`, `UPDATE_GROUP`, `REMOVE_GROUP`, `SET_ORGANIZER_TOKEN`
- Persist both to localStorage keys above
- Keep existing `sessionId` / `organizerToken` for backward compatibility (personal session)

## UI — Groups List on `/availability`

Section rendered below existing availability content:

```
Your Groups                          [+ New group]

┌─────────────────────────────────────────────────┐
│ 🗓 Team standup sync         organizer  3d ago   │
│ [Open] [Copy link] [Rename] [Leave]              │
├─────────────────────────────────────────────────┤
│ 🗓 Dinner planning           participant 1d ago  │
│ [Open] [Copy link] [Rename] [Leave]              │
└─────────────────────────────────────────────────┘
```

- **Rename** — toggles inline text input on that row
- **Leave** — removes from list with confirmation
- **+ New group** — navigates to `/sessions/new` with name prompt added
- Default name: `"Group [sessionId]"` if user skips naming

## Flow Changes

### Creating a group (`/sessions/new`)
1. Add a group name input field (optional, defaults to `"Group [sessionId]"`)
2. After session created, `ADD_GROUP` + `SET_ORGANIZER_TOKEN` into AppContext

### Joining a group (`/sessions/[id]/join`)
1. Add a group name input field before submit (optional)
2. After POST succeeds and returns `participantId`, store `ADD_GROUP` with `participantId`

## Backend — New Participant Update Endpoint

**`PATCH /api/sessions/[id]/participants/[participantId]`**

- Body: `{ participantToken: string, blocks: BusyBlock[] }`
- Auth: `participantToken` must equal `participantId` (same pattern as POST)
- Updates participant's blocks in-place — no new entry created
- Returns `{ ok: true }`

## Auto-Sync Blocks to All Groups

Debounced effect (1 second) triggered when `state.blocks` changes:

- For each group in `state.groups`:
  - **organizer**: `PUT /api/sessions/[id]/participants` with token from `state.organizerTokens`
  - **participant**: `PATCH /api/sessions/[id]/participants/[participantId]` with `participantId` as token
- All syncs fire in parallel; failures are non-fatal (fire-and-forget)

## Component Summary

| What | Where |
|------|-------|
| `GroupEntry[]` in localStorage | AppContext |
| Groups list UI | `src/components/GroupsList.tsx` (new) |
| Render groups list | `src/app/availability/page.tsx` |
| Name prompt when creating | `src/app/sessions/new/page.tsx` |
| Name prompt when joining | `src/app/sessions/[id]/join/page.tsx` |
| Participant update endpoint | `src/app/api/sessions/[id]/participants/[participantId]/route.ts` (new) |
| Auto-sync effect | `src/app/availability/page.tsx` |
