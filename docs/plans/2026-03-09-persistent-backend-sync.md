# Persistent Backend Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Make personal calendars persist on the backend so groups always see the latest blocks via references instead of copies.

**Architecture:** Personal sessions store blocks; group sessions store participant references (personalSessionId). On group GET, the server resolves each reference by fetching blocks from the participant's personal session. The frontend auto-syncs blocks to the personal session on every change.

**Tech Stack:** Next.js 16, Upstash Redis, React 19, TypeScript

---

### Task 1: Update types — add `type` field to Session

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Update the Session interface**

Add `type` field and a participant reference type:

```typescript
// In Session interface, add after sessionId:
type: 'personal' | 'group';

// Change participants type to support both formats:
participants: {
  [participantId: string]: BusyBlock[] | { personalSessionId: string };
};
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`

Expect: Build errors in files that use `session.participants` (expected — will fix in later tasks).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add type field and participant references to Session type"
```

---

### Task 2: Update session.ts — createSession accepts type, add resolveGroupParticipants helper

**Files:**
- Modify: `src/lib/session.ts`

**Step 1: Update createSession to accept type**

```typescript
export async function createSession(opts: {
  quorum: number;
  lookAheadDays: number;
  expiryDays?: number;
  type?: 'personal' | 'group';
}): Promise<{ sessionId: string; organizerToken: string }> {
  const sessionId = generateToken(12);
  const organizerToken = generateToken(32);
  const hashedToken = await bcrypt.hash(organizerToken, 10);
  const sessionType = opts.type ?? 'group';
  const session: Session = {
    sessionId,
    type: sessionType,
    organizerToken: hashedToken,
    quorum: opts.quorum,
    lookAheadDays: opts.lookAheadDays,
    createdAt: new Date().toISOString(),
    participants: {},
  };
  // Personal sessions get 90 days, groups get expiryDays (default 7)
  const ttl = sessionType === 'personal'
    ? 90 * 86400
    : (opts.expiryDays ?? 7) * 86400;
  await kv.set(`session:${sessionId}`, session, { ex: ttl });
  return { sessionId, organizerToken };
}
```

**Step 2: Add resolveGroupParticipants helper**

This function takes a group session and resolves all participant references into actual blocks:

```typescript
export async function resolveGroupParticipants(
  session: Session
): Promise<{ id: string; blocks: BusyBlock[] }[]> {
  const entries = Object.entries(session.participants);
  const results: { id: string; blocks: BusyBlock[] }[] = [];

  for (const [pid, value] of entries) {
    if (Array.isArray(value)) {
      // Legacy: blocks stored directly (backward compat)
      results.push({ id: pid, blocks: value });
    } else if (value && typeof value === 'object' && 'personalSessionId' in value) {
      // Reference: fetch from personal session
      const personalSession = await getSession(value.personalSessionId);
      if (personalSession) {
        const blocks = personalSession.participants['__organizer__'];
        if (Array.isArray(blocks)) {
          results.push({ id: pid, blocks });
        }
      }
    }
  }
  return results;
}
```

**Step 3: Add refreshSessionTTL helper**

```typescript
export async function refreshSessionTTL(sessionId: string, ttlSeconds: number): Promise<void> {
  await kv.expire(`session:${sessionId}`, ttlSeconds);
}
```

**Step 4: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat: add session type, resolveGroupParticipants, and TTL refresh"
```

---

### Task 3: Update POST /api/sessions — accept type parameter

**Files:**
- Modify: `src/app/api/sessions/route.ts`

**Step 1: Update the handler**

```typescript
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  const body = await req.json();
  const quorum = Number(body.quorum ?? 1);
  const lookAheadDays = Number(body.lookAheadDays ?? 14);
  const expiryDays = Number(body.expiryDays ?? 7);
  const type = body.type === 'personal' ? 'personal' : 'group';

  if (!Number.isFinite(quorum) || quorum < 1 || !Number.isFinite(lookAheadDays) || lookAheadDays < 1 || lookAheadDays > 90) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const result = await createSession({ quorum, lookAheadDays, expiryDays, type });
  return NextResponse.json(result, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add src/app/api/sessions/route.ts
git commit -m "feat: POST /api/sessions accepts type parameter"
```

---

### Task 4: Update GET /api/sessions/[id] — resolve participant references

**Files:**
- Modify: `src/app/api/sessions/[id]/route.ts`

**Step 1: Update GET handler to resolve references**

```typescript
import { NextResponse } from 'next/server';
import { kv, verifyOrganizerToken, resolveGroupParticipants } from '@/lib/session';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyOrganizerToken(id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve participant references to actual blocks
  const participants = await resolveGroupParticipants(session);

  return NextResponse.json({
    participants,
    quorum: session.quorum,
    lookAheadDays: session.lookAheadDays,
  });
}
```

DELETE handler stays the same.

**Step 2: Commit**

```bash
git add src/app/api/sessions/[id]/route.ts
git commit -m "feat: GET /api/sessions/[id] resolves participant block references"
```

---

### Task 5: Update POST /api/sessions/[id]/participants — accept personalSessionId

**Files:**
- Modify: `src/app/api/sessions/[id]/participants/route.ts`

**Step 1: Update POST to store reference instead of blocks**

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { participantToken, personalSessionId } = body as {
    participantToken: string;
    personalSessionId: string;
  };

  if (!participantToken || !personalSessionId) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (participantToken !== id) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  // Verify the personal session exists
  const personalSession = await getSession(personalSessionId);
  if (!personalSession) {
    return NextResponse.json({ error: 'Personal session not found' }, { status: 400 });
  }

  const MAX_PARTICIPANTS = 20;
  if (Object.keys(session.participants).length >= MAX_PARTICIPANTS) {
    return NextResponse.json({ error: 'Session is full' }, { status: 409 });
  }

  const participantId = generateToken(12);
  const updated: Session = {
    ...session,
    participants: {
      ...session.participants,
      [participantId]: { personalSessionId },
    },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ participantId }, { status: 201 });
}
```

**Step 2: Keep PUT handler mostly the same**

The PUT handler (organizer syncing blocks to personal session) stays the same — it writes blocks under `__organizer__` and refreshes TTL:

```typescript
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyOrganizerToken(id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { blocks } = body as { blocks: BusyBlock[] };
  if (!Array.isArray(blocks)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (blocks.length > 1000) {
    return NextResponse.json({ error: 'Too many blocks' }, { status: 400 });
  }

  const safeBlocks = sanitiseBlocks(blocks);
  for (const b of safeBlocks) {
    if (!ISO_RE.test(b.start) || !ISO_RE.test(b.end)) {
      return NextResponse.json({ error: 'Invalid block date format' }, { status: 400 });
    }
  }

  const updated: Session = {
    ...session,
    participants: { ...session.participants, __organizer__: safeBlocks },
  };
  // Refresh TTL — 90 days for personal sessions
  const ttl = session.type === 'personal' ? 90 * 86400 : undefined;
  await kv.set(`session:${id}`, updated, ttl ? { ex: ttl } : { keepTtl: true });
  return NextResponse.json({ ok: true });
}
```

**Step 3: Remove unused imports**

Remove `ISO_RE` and `sanitiseBlocks` from the POST handler imports (only needed by PUT now). Keep all imports at top since both handlers share the file.

**Step 4: Commit**

```bash
git add src/app/api/sessions/[id]/participants/route.ts
git commit -m "feat: group join stores personalSessionId reference instead of blocks"
```

---

### Task 6: Remove PATCH participant endpoint

**Files:**
- Delete: `src/app/api/sessions/[id]/participants/[participantId]/route.ts`

Blocks are no longer stored in group sessions, so per-participant PATCH is unnecessary. Block updates go to the personal session via PUT.

**Step 1: Delete the file**

```bash
rm src/app/api/sessions/[id]/participants/[participantId]/route.ts
```

**Step 2: Commit**

```bash
git add -A src/app/api/sessions/[id]/participants/[participantId]/
git commit -m "feat: remove PATCH participant endpoint — blocks live in personal sessions"
```

---

### Task 7: Update AppContext — auto-sync blocks to backend

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add syncBlocksToBackend helper**

Add a fire-and-forget function that ensures a personal session exists and syncs blocks:

```typescript
async function ensurePersonalSession(
  state: AppState,
  dispatch: React.Dispatch<Action>,
): Promise<{ sessionId: string; organizerToken: string } | null> {
  if (state.sessionId && state.organizerToken) {
    return { sessionId: state.sessionId, organizerToken: state.organizerToken };
  }
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
    });
    if (!res.ok) return null;
    const { sessionId, organizerToken } = await res.json();
    dispatch({ type: 'SET_SESSION', sessionId, organizerToken });
    return { sessionId, organizerToken };
  } catch {
    return null;
  }
}

async function syncBlocksToBackend(
  blocks: BusyBlock[],
  state: AppState,
  dispatch: React.Dispatch<Action>,
): Promise<void> {
  const creds = await ensurePersonalSession(state, dispatch);
  if (!creds) return;
  try {
    await fetch(`/api/sessions/${creds.sessionId}/participants`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.organizerToken}`,
      },
      body: JSON.stringify({ blocks }),
    });
  } catch (err) {
    console.warn('Failed to sync blocks to backend:', err);
  }
}
```

**Step 2: Add useEffect that syncs blocks on change**

After the existing blocks localStorage persistence effect, add:

```typescript
// Sync blocks to backend on every change
const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
useEffect(() => {
  if (!hydrated) return;
  // Debounce: wait 500ms after last change before syncing
  clearTimeout(syncTimeoutRef.current);
  syncTimeoutRef.current = setTimeout(() => {
    syncBlocksToBackend(state.blocks, state, dispatch);
  }, 500);
  return () => clearTimeout(syncTimeoutRef.current);
}, [state.blocks, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
```

Note: `state` and `dispatch` are stable references from useReducer so they don't need to be in deps. The eslint disable is for `state` (we only want to trigger on `state.blocks` changes, reading `state.sessionId`/`state.organizerToken` from the closure is fine).

**Step 3: Add useRef import**

Add `useRef` to the React imports at the top.

**Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: auto-sync blocks to personal session backend on every change"
```

---

### Task 8: Update group session page — remove myBlocks overlay

**Files:**
- Modify: `src/app/sessions/[id]/page.tsx`

**Step 1: Remove client-side block merging**

The server now returns all participant blocks (including yours via personal session reference). Remove `myBlocks` overlay logic:

- Remove `const myBlocks = state.blocks;`
- Remove `const allBusy = [...myBlocks, ...participants.flatMap((p) => p.blocks)];`
- Remove `const allParticipantBlocks = [myBlocks, ...participants.map((p) => p.blocks)];`
- Remove `const totalCount = participants.length + (myBlocks.length > 0 ? 1 : 0);`
- Change to use participants directly from server:

```typescript
const allBusy = participants.flatMap((p) => p.blocks);
const allParticipantBlocks = participants.map((p) => p.blocks);
const totalCount = participants.length;
```

- Update subtitle: remove "+ your calendar" since you're already in the participants list
- Pass `allBusy` (plus freeSlots) to grid as before

**Step 2: Commit**

```bash
git add src/app/sessions/[id]/page.tsx
git commit -m "feat: group session uses server-resolved blocks, remove client overlay"
```

---

### Task 9: Update join page — send personalSessionId instead of blocks

**Files:**
- Modify: `src/app/sessions/[id]/join/page.tsx`

**Step 1: Update submitBlocks function**

Replace the block-submission logic with personal-session-reference logic:

```typescript
async function submitBlocks() {
  if (!sessionId) return;
  setSubmitting(true);
  setError(null);
  try {
    // 1. Ensure personal session exists and blocks are synced
    let personalId = state.sessionId;
    let personalToken = state.organizerToken;

    if (!personalId || !personalToken) {
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
      });
      if (!createRes.ok) throw new Error('Failed to create personal session');
      const created = await createRes.json();
      personalId = created.sessionId as string;
      personalToken = created.organizerToken as string;
      dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
    }

    // 2. Sync current blocks to personal session
    dispatch({ type: 'SET_BLOCKS', blocks: localBlocks });
    await fetch(`/api/sessions/${personalId}/participants`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personalToken}`,
      },
      body: JSON.stringify({ blocks: localBlocks }),
    });

    // 3. Join the group with personal session reference
    const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken: sessionId, personalSessionId: personalId }),
    });
    if (!joinRes.ok) {
      const d = await joinRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? 'Failed to join group session');
    }

    const { participantId } = await joinRes.json() as { participantId: string };

    const resolvedName = groupName.trim() || `Group ${sessionId}`;
    dispatch({
      type: 'ADD_GROUP',
      group: {
        sessionId,
        role: 'participant',
        participantId,
        name: resolvedName,
        joinedAt: new Date().toISOString(),
      },
    });

    setPersonalSessionId(personalId);
    setSubmitted(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Submission failed.');
  } finally {
    setSubmitting(false);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/sessions/[id]/join/page.tsx
git commit -m "feat: join group sends personalSessionId reference instead of block copies"
```

---

### Task 10: Verify build and test end-to-end

**Step 1: Build**

```bash
npx next build
```

Expected: Clean build with no errors.

**Step 2: Manual smoke test**

1. Start dev server: `npx next dev`
2. Import a calendar or manually toggle blocks in the grid
3. Verify blocks sync to backend (check network tab for PUT to /api/sessions/{id}/participants)
4. Create a group session — verify it creates successfully
5. Open group session — verify participants show up with live blocks
6. Update blocks on availability page — refresh group page and verify updated blocks appear

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: persistent backend sync — groups reference personal sessions"
```
