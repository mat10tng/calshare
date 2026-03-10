# Persistent Backend Sync Design

**Date**: 2026-03-09

## Problem

Personal calendar blocks live only in localStorage. Groups receive a one-time copy of blocks at join time. Updating your calendar doesn't propagate to groups. Users want consistent sharing across friend groups.

## Core Change

Groups stop storing copies of blocks. They store references to each member's personal session ID. When viewing a group, the server fetches each member's current blocks from their personal session in Redis.

## Data Model

### Session model change

```
// Before: groups store block copies
participants: { [participantId]: BusyBlock[] }

// After: groups store personal session references
participants: { [participantId]: { personalSessionId: string } }
```

### Session types

Sessions gain a `type` field: `'personal'` or `'group'`.

- **Personal**: 90-day TTL, refreshed on every block update. One per user. Stores blocks under `__organizer__` key.
- **Group**: 7-day TTL (unchanged). Stores participant references, not blocks.

## Data Flow

### Calendar update
1. User updates blocks locally (import, grid edit, drag)
2. Frontend PUTs blocks to personal session backend
3. All groups see latest blocks because they reference the personal session

### Group view
1. `GET /api/sessions/{groupId}` — server reads participant list
2. For each participant, server fetches blocks from their personal session in Redis
3. Returns assembled `{ participants: [{id, blocks}], quorum }` — same response shape

### Group join
1. User POSTs `{ participantToken, personalSessionId }` — no blocks
2. Group stores the reference
3. If user has no personal session, auto-create one first

## API Changes

### `POST /api/sessions`
- Add `type: 'personal' | 'group'` field
- Personal sessions get 90-day TTL (refreshed on update)

### `POST /api/sessions/{id}/participants` (join group)
- Body: `{ participantToken, personalSessionId }` instead of `{ participantToken, blocks }`
- Stores reference, not block copy

### `GET /api/sessions/{id}` (view group)
- Server resolves each participant's `personalSessionId`
- Fetches current blocks from Redis per participant
- Same response shape as today

### `PUT /api/sessions/{id}/participants` (sync blocks)
- Primary "sync blocks to backend" endpoint
- Called on every local block change
- Refreshes personal session TTL

### `PATCH /api/sessions/{id}/participants/{participantId}`
- Remove — blocks no longer stored in groups

### `GET /api/sessions/{id}/public`
- No change — reads from personal session's `__organizer__` blocks

## Frontend Changes

### AppContext
- Every block mutation (`SET_BLOCKS`, `IMPORT_CALENDAR`, `CLEAR_BLOCKS`) triggers PUT to personal session
- Auto-create personal session on first block update if none exists
- Fire-and-forget sync — no loading spinners, console warning on failure, localStorage as fallback

### Group session page
- Remove client-side `myBlocks` overlay — server returns live blocks for all participants
- Polling unchanged (10s interval)

### Join page
- POST only `{ participantToken, personalSessionId }` — no blocks
- Auto-create personal session if needed before joining
