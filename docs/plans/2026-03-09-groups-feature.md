# Groups Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Let users track multiple group sessions they've created or joined, with local naming, auto-sync of availability, and inline management actions.

**Architecture:** Groups are stored in localStorage via AppContext (`calshare:groups` + `calshare:organizerTokens`). A new `GroupsList` component renders below the availability grid. A new `PATCH /api/sessions/[id]/participants/[participantId]` endpoint lets participants update their blocks. An auto-sync effect in the availability page pushes block changes to all joined groups.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Upstash Redis (kv), localStorage, Jest + ts-jest

---

### Task 1: Add GroupEntry type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add the type**

In `src/types/index.ts`, append:

```ts
export interface GroupEntry {
  sessionId: string;
  role: 'organizer' | 'participant';
  participantId?: string;   // participants only — used for block updates
  name: string;             // user's local label, editable anytime
  joinedAt: string;         // ISO timestamp
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add GroupEntry type"
```

---

### Task 2: Update AppContext with groups state

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Expand AppState**

Add to the `AppState` interface:

```ts
groups: GroupEntry[];
organizerTokens: Record<string, string>;
```

Import `GroupEntry` from `@/types`.

**Step 2: Add actions**

Add to the `Action` union type:

```ts
| { type: 'ADD_GROUP'; group: GroupEntry }
| { type: 'UPDATE_GROUP'; sessionId: string; changes: Partial<GroupEntry> }
| { type: 'REMOVE_GROUP'; sessionId: string }
| { type: 'SET_ORGANIZER_TOKEN'; sessionId: string; token: string }
```

**Step 3: Add reducer cases**

```ts
case 'ADD_GROUP':
  // Replace if sessionId already exists, otherwise append
  return {
    ...state,
    groups: state.groups.some(g => g.sessionId === action.group.sessionId)
      ? state.groups.map(g => g.sessionId === action.group.sessionId ? action.group : g)
      : [...state.groups, action.group],
  };
case 'UPDATE_GROUP':
  return {
    ...state,
    groups: state.groups.map(g =>
      g.sessionId === action.sessionId ? { ...g, ...action.changes } : g
    ),
  };
case 'REMOVE_GROUP':
  return { ...state, groups: state.groups.filter(g => g.sessionId !== action.sessionId) };
case 'SET_ORGANIZER_TOKEN':
  return {
    ...state,
    organizerTokens: { ...state.organizerTokens, [action.sessionId]: action.token },
  };
```

**Step 4: Update INITIAL_STATE**

```ts
const INITIAL_STATE: AppState = {
  blocks: [],
  preferences: DEFAULT_PREFS,
  sessionId: null,
  organizerToken: null,
  groups: [],
  organizerTokens: {},
};
```

**Step 5: Add localStorage persistence (load)**

In the hydration `useEffect`, add:

```ts
const savedGroups = localStorage.getItem('calshare:groups');
if (savedGroups) {
  const parsed = JSON.parse(savedGroups) as GroupEntry[];
  parsed.forEach(g => dispatch({ type: 'ADD_GROUP', group: g }));
}
const savedOrganizerTokens = localStorage.getItem('calshare:organizerTokens');
if (savedOrganizerTokens) {
  const tokens = JSON.parse(savedOrganizerTokens) as Record<string, string>;
  Object.entries(tokens).forEach(([sessionId, token]) =>
    dispatch({ type: 'SET_ORGANIZER_TOKEN', sessionId, token })
  );
}
```

**Step 6: Add localStorage persistence (save)**

Add two new `useEffect` blocks:

```ts
useEffect(() => {
  try {
    localStorage.setItem('calshare:groups', JSON.stringify(state.groups));
  } catch { /* ignore */ }
}, [state.groups]);

useEffect(() => {
  try {
    localStorage.setItem('calshare:organizerTokens', JSON.stringify(state.organizerTokens));
  } catch { /* ignore */ }
}, [state.organizerTokens]);
```

**Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 8: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add groups and organizerTokens to AppContext"
```

---

### Task 3: New PATCH participant endpoint

**Files:**
- Create: `src/app/api/sessions/[id]/participants/[participantId]/route.ts`

**Step 1: Create the route file**

```ts
import { NextResponse } from 'next/server';
import { kv, getSession } from '@/lib/session';
import type { BusyBlock, Session } from '@/types';

const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

function sanitiseBlocks(blocks: BusyBlock[]): BusyBlock[] {
  return blocks.map(b => ({
    start: String(b.start),
    end: String(b.end),
    busy: Boolean(b.busy),
    allDay: Boolean(b.allDay),
    ...(b.title ? { title: String(b.title).slice(0, 200) } : {}),
  }));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const { id, participantId } = await params;

  const body = await req.json();
  const { participantToken, blocks } = body as { participantToken: string; blocks: BusyBlock[] };

  if (!participantToken || !Array.isArray(blocks)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Auth: participantToken must match participantId
  if (participantToken !== participantId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Participant slot must already exist
  if (!(participantId in session.participants)) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
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
    participants: { ...session.participants, [participantId]: safeBlocks },
  };
  await kv.set(`session:${id}`, updated, { keepTtl: true });
  return NextResponse.json({ ok: true });
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/participants/[participantId]/route.ts
git commit -m "feat: add PATCH participant blocks endpoint"
```

---

### Task 4: Create GroupsList component

**Files:**
- Create: `src/components/GroupsList.tsx`

**Step 1: Create the component**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GroupEntry } from '@/types';

interface Props {
  groups: GroupEntry[];
  onRename: (sessionId: string, name: string) => void;
  onLeave: (sessionId: string) => void;
}

export function GroupsList({ groups, onRename, onLeave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function startRename(group: GroupEntry) {
    setEditingId(group.sessionId);
    setEditName(group.name);
  }

  function commitRename(sessionId: string) {
    const trimmed = editName.trim();
    if (trimmed) onRename(sessionId, trimmed);
    setEditingId(null);
  }

  async function copyLink(sessionId: string) {
    const url = `${window.location.origin}/sessions/${sessionId}/join`;
    await navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (groups.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Your Groups</h2>
        <Link
          href="/sessions/new"
          className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          + New group
        </Link>
      </div>
      <ul className="divide-y border rounded-xl overflow-hidden">
        {groups.map((group) => (
          <li key={group.sessionId} className="px-4 py-3 bg-white">
            {/* Name row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🗓</span>
              {editingId === group.sessionId ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(group.sessionId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(group.sessionId);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 border rounded px-2 py-0.5 text-sm"
                />
              ) : (
                <span className="flex-1 text-sm font-medium">{group.name}</span>
              )}
              <span className="text-xs text-gray-400 capitalize">{group.role}</span>
              <span className="text-xs text-gray-400">
                {new Date(group.joinedAt).toLocaleDateString()}
              </span>
            </div>
            {/* Action row */}
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/sessions/${group.sessionId}`}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
              >
                Open
              </Link>
              <button
                onClick={() => copyLink(group.sessionId)}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
              >
                {copiedId === group.sessionId ? '✓ Copied' : 'Copy link'}
              </button>
              <button
                onClick={() => startRename(group)}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
              >
                Rename
              </button>
              {leavingId === group.sessionId ? (
                <>
                  <span className="text-xs text-gray-500 self-center">Remove from list?</span>
                  <button
                    onClick={() => { onLeave(group.sessionId); setLeavingId(null); }}
                    className="text-xs border border-red-200 text-red-600 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors"
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setLeavingId(null)}
                    className="text-xs border rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setLeavingId(group.sessionId)}
                  className="text-xs border border-red-200 text-red-600 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors"
                >
                  Leave
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 3: Commit**

```bash
git add src/components/GroupsList.tsx
git commit -m "feat: add GroupsList component"
```

---

### Task 5: Update /sessions/new to track organizer groups

**Files:**
- Modify: `src/app/sessions/new/page.tsx`

**Step 1: Add name input state**

Add to existing state declarations:

```ts
const [groupName, setGroupName] = useState('');
```

**Step 2: Add name input field in JSX**

Add before the quorum input:

```tsx
<div className="mb-6">
  <label className="block text-sm font-medium mb-2">
    Group name <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="text"
    value={groupName}
    onChange={(e) => setGroupName(e.target.value)}
    placeholder="e.g. Team standup sync"
    className="border rounded-lg px-3 py-2 w-full text-base"
    maxLength={80}
  />
</div>
```

**Step 3: Track the group after creation**

In `handleCreate`, after `dispatch({ type: 'SET_SESSION', ... })`:

```ts
const resolvedName = groupName.trim() || `Group ${sessionId}`;
dispatch({
  type: 'ADD_GROUP',
  group: {
    sessionId,
    role: 'organizer',
    name: resolvedName,
    joinedAt: new Date().toISOString(),
  },
});
dispatch({ type: 'SET_ORGANIZER_TOKEN', sessionId, token: organizerToken });
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 5: Commit**

```bash
git add src/app/sessions/new/page.tsx
git commit -m "feat: track organizer group on session create"
```

---

### Task 6: Update /sessions/[id]/join to track participant groups

**Files:**
- Modify: `src/app/sessions/[id]/join/page.tsx`

**Step 1: Add name input state**

Add to existing state:

```ts
const [groupName, setGroupName] = useState('');
```

**Step 2: Add name input field in JSX**

Add just above the submit button:

```tsx
<div className="mt-4">
  <label className="block text-sm font-medium mb-1">
    Name this group <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="text"
    value={groupName}
    onChange={(e) => setGroupName(e.target.value)}
    placeholder="e.g. Dinner planning"
    className="border rounded-lg px-3 py-2 w-full text-sm"
    maxLength={80}
  />
</div>
```

**Step 3: Store participantId and group entry after joining**

In `submitBlocks`, after the join POST succeeds, retrieve `participantId` from the response and store it:

```ts
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
```

Note: the current code discards the join response body — change:
```ts
if (!joinRes.ok) { ... }
// no assignment currently
```
to:
```ts
if (!joinRes.ok) { ... }
const { participantId } = await joinRes.json() as { participantId: string };
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 5: Commit**

```bash
git add src/app/sessions/[id]/join/page.tsx
git commit -m "feat: track participant group and store participantId on join"
```

---

### Task 7: Add auto-sync and render GroupsList on /availability

**Files:**
- Modify: `src/app/availability/page.tsx`

**Step 1: Import GroupsList**

```ts
import { GroupsList } from '@/components/GroupsList';
```

**Step 2: Add auto-sync effect**

Add after the existing organizer sync effect:

```ts
// Sync blocks to all joined groups (debounced 1 s)
useEffect(() => {
  if (state.groups.length === 0) return;
  const timer = setTimeout(() => {
    for (const group of state.groups) {
      if (group.role === 'organizer') {
        const token = state.organizerTokens[group.sessionId];
        if (!token) continue;
        fetch(`/api/sessions/${group.sessionId}/participants`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ blocks: state.blocks }),
        }).catch(() => {/* non-fatal */});
      } else if (group.role === 'participant' && group.participantId) {
        fetch(`/api/sessions/${group.sessionId}/participants/${group.participantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantToken: group.participantId,
            blocks: state.blocks,
          }),
        }).catch(() => {/* non-fatal */});
      }
    }
  }, 1000);
  return () => clearTimeout(timer);
}, [state.blocks, state.groups, state.organizerTokens]);
```

**Step 3: Add rename and leave handlers**

```ts
function handleRename(sessionId: string, name: string) {
  dispatch({ type: 'UPDATE_GROUP', sessionId, changes: { name } });
}

function handleLeave(sessionId: string) {
  dispatch({ type: 'REMOVE_GROUP', sessionId });
}
```

**Step 4: Render GroupsList below existing main content**

At the bottom of the `<main>` element (after the free times grid / buttons):

```tsx
<GroupsList
  groups={state.groups}
  onRename={handleRename}
  onLeave={handleLeave}
/>
```

Also add a `+ New group` entry point when `groups.length === 0` in the empty state, or simply rely on the existing "Plan with a group" / "Schedule with open availability" links — no change needed there.

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 6: Run tests**

```bash
npm test
```

Expected: all existing tests pass

**Step 7: Commit**

```bash
git add src/app/availability/page.tsx
git commit -m "feat: render GroupsList and auto-sync blocks to all groups"
```

---

### Task 8: Smoke test end-to-end

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Verify create flow**

1. Go to `/sessions/new`
2. Enter group name "My Test Group", click Create
3. Go back to `/availability` — "My Test Group" should appear in the groups list
4. Update some blocks — check network tab for `PUT /api/sessions/[id]/participants` firing after ~1s

**Step 3: Verify join flow**

1. Open incognito / second browser
2. Navigate to the join link
3. Enter group name "Incognito Group", submit
4. Go to `/availability` in that browser — "Incognito Group" appears in list
5. Update blocks — check network tab for `PATCH /api/sessions/[id]/participants/[participantId]` firing

**Step 4: Verify rename**

1. Click Rename on a group
2. Type new name, press Enter
3. Name updates in the list; persists on page refresh

**Step 5: Verify leave**

1. Click Leave → "Remove from list?" confirmation
2. Click "Yes, remove" — group disappears from list
3. Refresh — group stays gone

**Step 6: Commit if any fixups needed, then done**
