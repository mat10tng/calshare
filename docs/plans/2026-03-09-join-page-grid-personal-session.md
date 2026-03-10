# Join Page Grid + Personal Session Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Participants joining a group session can drag-edit their availability inline, and submitting creates both their participant entry and a personal session with their own shareable `/u/[id]` URL.

**Architecture:** Three independent pieces: (1) a new unauthenticated public API endpoint exposing the organizer's blocks, (2) a new `/u/[id]` page that reads from it for a public read-only view, (3) a full rewrite of the join page to embed an editable `AvailabilityGrid` and fire two API calls on submit (join group + create personal session). No new shared components needed — `AvailabilityGrid` already supports `onBlocksChange`.

**Tech Stack:** Next.js 15 App Router, React 19 `useState`, existing `AvailabilityGrid` component, `@upstash/redis` via `getSession()`, `AppContext` dispatch.

---

### Task 0: Public session API endpoint

Returns the organizer's (`__organizer__`) blocks for a session without requiring auth. Used by `/u/[id]`.

**Files:**
- Create: `src/app/api/sessions/[id]/public/route.ts`

**Context:**
- `getSession(id)` is in `src/lib/session.ts` — returns the full `Session` object or null
- `Session.participants` is `{ [participantId: string]: BusyBlock[] }` — the organizer's slot is keyed `__organizer__`
- The existing `/api/sessions/[id]/join` GET (in `src/app/api/sessions/[id]/join/route.ts`) is a good template for an unauthenticated GET route

**Step 1: Create the route**

```typescript
// src/app/api/sessions/[id]/public/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const organizerBlocks = session.participants['__organizer__'] ?? [];
  return NextResponse.json({
    sessionId: session.sessionId,
    lookAheadDays: session.lookAheadDays,
    blocks: organizerBlocks,
  });
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/public/route.ts
git commit -m "feat: add public GET endpoint for organizer blocks"
```

---

### Task 1: `/u/[id]` public availability page

A public read-only view of any organizer's availability. Shows their grid and a button to join their group session.

**Files:**
- Create: `src/app/u/[id]/page.tsx`

**Context:**
- `AvailabilityGrid` is in `src/components/AvailabilityGrid.tsx` — pass no `onBlocksChange` for read-only mode
- `Nav` is in `src/components/Nav.tsx`
- Look at `src/app/sessions/[id]/page.tsx` for the pattern of resolving `params` with `useEffect` + `useState`
- Date range: use today + `lookAheadDays` from the API response (same pattern as `availability/page.tsx`)

**Step 1: Create the page**

```tsx
// src/app/u/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

export default function PublicAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [blocks, setBlocks] = useState<BusyBlock[]>([]);
  const [lookAheadDays, setLookAheadDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(async (p) => {
      setSessionId(p.id);
      const res = await fetch(`/api/sessions/${p.id}/public`);
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setBlocks(data.blocks);
      setLookAheadDays(data.lookAheadDays);
      setLoading(false);
    });
  }, [params]);

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + lookAheadDays * 86_400_000).toISOString().split('T')[0];

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto py-12 px-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : notFound ? (
          <p className="text-gray-500">This availability link has expired or doesn&apos;t exist.</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold">Shared availability</h1>
              {sessionId && (
                <Link
                  href={`/sessions/${sessionId}/join`}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Join their group session →
                </Link>
              )}
            </div>
            <AvailabilityGrid blocks={blocks} fromDate={now} toDate={until} />
          </>
        )}
      </main>
    </>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Verify in preview**

Navigate to `/u/test-nonexistent-id` — should show "expired or doesn't exist" message (graceful 404).

**Step 4: Commit**

```bash
git add src/app/u/[id]/page.tsx
git commit -m "feat: add public /u/[id] availability view page"
```

---

### Task 2: Rewrite join page with inline grid + personal session creation

The join page becomes a full availability editor. On submit, the participant joins the group session AND gets their own personal session URL.

**Files:**
- Modify: `src/app/sessions/[id]/join/page.tsx`

**Context — how submit must work:**
1. `POST /api/sessions/[groupId]/participants` with `{ participantToken: groupId, blocks: localBlocks }` — joins the group
2. If `!state.sessionId`: `POST /api/sessions` with `{ quorum: 1, lookAheadDays: 14, expiryDays: 30 }` → returns `{ sessionId, organizerToken }`
3. `PUT /api/sessions/[personalId]/participants` with `Authorization: Bearer [organizerToken]` and `{ blocks: localBlocks }` — saves personal organizer slot
4. `dispatch({ type: 'SET_BLOCKS', blocks: localBlocks })` — save blocks locally
5. `dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken })` — save personal session

**Context — state to add:**
- `localBlocks: BusyBlock[]` — initialized from `state.blocks`, updated by grid drag
- `personalSessionId: string | null` — set after submit, used in success view

**Context — width:** Change `max-w-md` to `max-w-4xl` to accommodate the grid.

**Context — lookAheadDays:** Already fetched from `/api/sessions/[id]/join` as `sessionInfo.lookAheadDays`. Use it for `toDate`.

**Step 1: Rewrite the page**

```tsx
// src/app/sessions/[id]/join/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { state, dispatch } = useApp();
  const [sessionId, setSessionId] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ lookAheadDays: number } | null>(null);
  const [localBlocks, setLocalBlocks] = useState<BusyBlock[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [personalSessionId, setPersonalSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      setSessionId(p.id);
      try {
        const res = await fetch(`/api/sessions/${p.id}/join`);
        if (res.ok) setSessionInfo(await res.json());
        else setError('Session not found or expired.');
      } catch {
        setError('Session not found or expired.');
      }
    });
  }, [params]);

  // Initialise local blocks from AppContext once (first non-empty load)
  useEffect(() => {
    setLocalBlocks(state.blocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  async function submitBlocks() {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Join the group session
      const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: sessionId, blocks: localBlocks }),
      });
      if (!joinRes.ok) {
        const d = await joinRes.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to join group session');
      }

      // 2. Save blocks to AppContext
      dispatch({ type: 'SET_BLOCKS', blocks: localBlocks });

      // 3. Create personal session if none exists
      let personalId = state.sessionId;
      let personalToken = state.organizerToken;

      if (!personalId || !personalToken) {
        const createRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, expiryDays: 30 }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          personalId = created.sessionId;
          personalToken = created.organizerToken;
          dispatch({ type: 'SET_SESSION', sessionId: personalId!, organizerToken: personalToken! });
        }
      }

      // 4. Save blocks to personal session organizer slot
      if (personalId && personalToken) {
        await fetch(`/api/sessions/${personalId}/participants`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${personalToken}`,
          },
          body: JSON.stringify({ blocks: localBlocks }),
        });
        setPersonalSessionId(personalId);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(
    Date.now() + (sessionInfo?.lookAheadDays ?? 14) * 86_400_000
  ).toISOString().split('T')[0];

  if (submitted) {
    const personalUrl = personalSessionId
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/u/${personalSessionId}`
      : null;

    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-bold mb-3">Availability submitted!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Your anonymised availability has been added to the group session.
        </p>
        {personalUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-blue-800 mb-2">Your personal availability link:</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white border rounded px-3 py-2 break-all">
                {personalUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(personalUrl)}
                className="text-sm border rounded-lg px-3 py-2 hover:bg-white transition-colors whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Share this link so others can see your availability.
            </p>
          </div>
        )}
      </main>
    );
  }

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-2">Join scheduling session</h1>
        {sessionInfo && (
          <p className="text-sm text-gray-500 mb-4">Looking ahead {sessionInfo.lookAheadDays} days</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-gray-600 font-medium">
            Mark your busy times (drag to toggle):
          </p>
          <Link
            href={`/availability/connect?returnTo=/sessions/${sessionId}/join`}
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            + Connect calendar
          </Link>
        </div>

        <AvailabilityGrid
          blocks={localBlocks}
          fromDate={now}
          toDate={until}
          onBlocksChange={setLocalBlocks}
        />

        <button
          onClick={submitBlocks}
          disabled={submitting || !sessionId}
          className="mt-6 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit my availability'}
        </button>
      </main>
    </>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Verify in preview**

Navigate to any `/sessions/[id]/join` URL:
- Grid should appear with current blocks (or empty)
- "Connect calendar" button should be visible top-right of the grid
- Drag should toggle cells
- On submit (with a valid session ID), success page should show the personal URL box

**Step 4: Commit**

```bash
git add src/app/sessions/[id]/join/page.tsx
git commit -m "feat: inline availability grid on join page with personal session creation"
```
