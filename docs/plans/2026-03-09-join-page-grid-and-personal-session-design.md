# Join Page Grid + Personal Session Design

**Goal:** New participants on the join page can drag-edit their availability directly inline, connect a real calendar, and on submit get both added to the group session AND given their own personal session URL.

**Architecture:** The join page becomes a full availability editor. On submit, two API calls fire: one to add the participant to the group session, one to create a personal session and save blocks as organizer. The success state surfaces the personal session URL (`/u/[sessionId]`). A new `/u/[sessionId]` route provides a public read-only view of any organizer's availability.

**Tech Stack:** Next.js App Router, React state, existing AvailabilityGrid component, existing `/api/sessions` endpoints.

---

## Component Changes

### `src/app/sessions/[id]/join/page.tsx`

- Add `AvailabilityGrid` with `onBlocksChange` callback (drag to toggle), pre-populated with `state.blocks`
- Add "Connect calendar" button → `/availability/connect?returnTo=/sessions/[id]/join`
- On submit:
  1. `POST /api/sessions/[id]/participants` — adds participant to group
  2. If no personal session (`!state.sessionId`): `POST /api/sessions` → create personal session, `PUT /api/sessions/[personal]/participants` (organizer slot)
  3. `dispatch({ type: 'SET_BLOCKS', blocks })` + `dispatch({ type: 'SET_SESSION', ... })`
- Success state: group confirmation + "Your personal availability: `/u/[sessionId]`" with copy button

### `src/app/u/[id]/page.tsx` (new)

- Public read-only view of any organizer's availability
- Fetches organizer blocks from new public API endpoint
- Shows `AvailabilityGrid` (non-editable, no `onBlocksChange`)
- "Join their group session" button → `/sessions/[id]/join`

### `src/app/api/sessions/[id]/public/route.ts` (new)

- Unauthenticated `GET` — returns only the `__organizer__` participant's blocks + `lookAheadDays`
- Used by `/u/[id]` page

---

## Data Flow

```
Participant visits /sessions/[id]/join
  └── Drags grid (local state, pre-filled from localStorage if any)
  └── OR clicks "Connect calendar" → /availability/connect?returnTo=join page → back with blocks
  └── Clicks "Submit"
        ├── POST /api/sessions/[id]/participants  (join group)
        ├── POST /api/sessions                    (create personal session)
        └── PUT  /api/sessions/[personal]/participants (save as personal organizer)
              └── dispatch SET_BLOCKS + SET_SESSION
              └── Show success: group joined + personal URL
```

---

## Acceptance Criteria

- [ ] Join page shows editable grid pre-filled with existing blocks (or empty/all-free if none)
- [ ] Dragging the grid updates local blocks (not yet committed to server)
- [ ] "Connect calendar" navigates to connect flow and returns with blocks loaded
- [ ] Submit joins the group and creates a personal session
- [ ] Success page shows the personal `/u/[sessionId]` URL with a copy button
- [ ] `/u/[sessionId]` shows a read-only grid of the organizer's blocks
- [ ] `/u/[sessionId]` has a "Join their group session" link
- [ ] TypeScript passes clean
