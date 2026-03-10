# Suggest a Date — Proposals Feature Design

## Goal

Allow group members to propose specific time slots for events directly on the group calendar. Other members vote yes/no. Multiple proposals can coexist for comparison.

## Architecture

Proposals are stored as an optional `proposals` array on the existing `Session` object in Redis. They inherit the group session's TTL (7 days) automatically. No new Redis keys or infrastructure needed.

## Data Model

```typescript
interface Proposal {
  id: string;           // 8-char random token
  title: string;        // e.g. "Team lunch"
  start: string;        // ISO 8601 UTC
  end: string;          // ISO 8601 UTC
  createdBy: string;    // participantId
  createdAt: string;    // ISO timestamp
  votes: Record<string, boolean>; // participantId → yes/no
}

interface Session {
  // ... existing fields ...
  proposals?: Proposal[];  // optional, group sessions only, max 10
}
```

## API

**POST `/api/sessions/[id]/proposals`** — Create proposal
- Body: `{ title, start, end, participantId }`
- Validates: participantId exists, slot valid, count < 10
- Returns: `{ proposal }` (201)

**PUT `/api/sessions/[id]/proposals/[proposalId]`** — Vote
- Body: `{ participantId, vote: boolean }`
- Sets `proposal.votes[participantId] = vote`
- Returns: `{ proposal }`

**DELETE `/api/sessions/[id]/proposals/[proposalId]`** — Dismiss
- Body: `{ participantId }` (must be creator)
- Returns: 204

Existing `GET /api/sessions/[id]` includes `proposals` in response — no new GET endpoint.

## UI: Suggest Mode

On the group session page:

1. **"Suggest a time" toggle button** near the group header. Activates suggest mode.
2. In suggest mode:
   - Drag-to-edit own availability is disabled
   - Click/drag cells to select a time range — accent-colored highlight on selected cells
   - On release, inline form appears: text input for title + "Propose" button
   - Submitting POSTs to API, exits suggest mode
3. Active proposals show as a subtle overlay on their grid cells (accent dot/border) so proposed times are visible without obscuring participant colors.

## UI: Proposal List & Voting

Below the grid, a proposals section:

- Compact card per proposal: title, time range, creator (cute name), vote tally
- **Yes / No** buttons — current vote highlighted
- Creator gets a dismiss (x) button
- Hover a card → highlights proposal's cells on the grid (DOM-direct classList, same pattern as participant hover)
- Click a card → scrolls grid to that time range
- No confirm/finalize action — proposals are informational, group decides externally

## Constraints

- Max 10 proposals per group session
- Only creator can dismiss their proposal
- Any group member can propose and vote
- Proposals auto-expire with the group session
