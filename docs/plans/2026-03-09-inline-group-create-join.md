# Inline Group Create / Join Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add "Create a new group" and "Join a group" inline forms directly under the availability grid, followed by the groups list, replacing the current navigation away to separate pages.

**Architecture:** Three changes: (1) extract a pure `parseSessionId` utility and TDD it, (2) update `GroupsList` to remove its now-redundant header button, (3) rewrite the bottom section of `availability/page.tsx` to hold both inline forms + GroupsList.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Jest + ts-jest

---

### Task 1: TDD — parseSessionId utility

Extract the session ID parsing logic as a pure testable function before wiring it into the UI.

**Files:**
- Create: `src/lib/parse-session-id.ts`
- Create: `src/lib/__tests__/parse-session-id.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/parse-session-id.test.ts`:

```typescript
import { parseSessionId } from '../parse-session-id';

describe('parseSessionId', () => {
  it('returns raw ID unchanged when given a plain session ID', () => {
    expect(parseSessionId('ABC123')).toBe('ABC123');
  });

  it('extracts session ID from a full join URL', () => {
    expect(parseSessionId('https://example.com/sessions/ABC123/join')).toBe('ABC123');
  });

  it('extracts session ID from a join URL without trailing slash', () => {
    expect(parseSessionId('http://localhost:3000/sessions/XYZ789/join')).toBe('XYZ789');
  });

  it('trims whitespace from input', () => {
    expect(parseSessionId('  ABC123  ')).toBe('ABC123');
  });

  it('returns null for empty string', () => {
    expect(parseSessionId('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseSessionId('   ')).toBeNull();
  });

  it('extracts from URL with query params', () => {
    expect(parseSessionId('https://example.com/sessions/ABC123/join?ref=email')).toBe('ABC123');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/tuan/Documents/Git/CalendarSharing/.claude/worktrees/heuristic-mahavira
npx jest src/lib/__tests__/parse-session-id.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../parse-session-id'"

**Step 3: Write minimal implementation**

Create `src/lib/parse-session-id.ts`:

```typescript
/**
 * Extracts a session ID from either a raw ID string or a full join URL.
 * Accepts: "ABC123" or "https://example.com/sessions/ABC123/join"
 * Returns null for empty input.
 */
export function parseSessionId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match /sessions/<id>/join pattern in a URL
  const match = trimmed.match(/\/sessions\/([^/?#]+)\/join/);
  if (match) return match[1];

  return trimmed;
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest src/lib/__tests__/parse-session-id.test.ts --no-coverage
```

Expected: PASS — 7 tests passing

**Step 5: Commit**

```bash
git add src/lib/parse-session-id.ts src/lib/__tests__/parse-session-id.test.ts
git commit -m "feat: add parseSessionId utility with tests"
```

---

### Task 2: Remove redundant "+ New group" button from GroupsList

The header button in `GroupsList` is redundant now that the create form lives inline on the availability page.

**Files:**
- Modify: `src/components/GroupsList.tsx:38-48`

**Step 1: Remove the header button**

In `src/components/GroupsList.tsx`, find the `<section>` wrapper. Replace the header `<div>` that contains both the `<h2>` and the `+ New group` Link:

Current (lines 39–48):
```tsx
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
```

Replace with:
```tsx
<section className="mt-10">
  <div className="mb-3">
    <h2 className="text-base font-semibold">Your Groups</h2>
  </div>
```

Also remove the `Link` import if it's no longer used anywhere in the file. Check — `Link` is used in the `Open` button inside the list (`<Link href={...sessions/${group.sessionId}}`), so keep it.

**Step 2: Run all tests to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests pass (no GroupsList tests exist — this is a visual-only change)

**Step 3: Commit**

```bash
git add src/components/GroupsList.tsx
git commit -m "feat: remove redundant new group button from GroupsList header"
```

---

### Task 3: Add inline create/join panel to availability page

This is the main UI change. Adds state + handlers + JSX for both forms, and moves GroupsList to sit below them.

**Files:**
- Modify: `src/app/availability/page.tsx`

**Step 1: Add imports and state**

At the top of `src/app/availability/page.tsx`, add the `parseSessionId` import alongside existing imports:

```typescript
import { parseSessionId } from '@/lib/parse-session-id';
```

Inside `AvailabilityPage()`, after the existing `useRef` and `useEffect` hooks, add these state variables:

```typescript
const [activePanel, setActivePanel] = useState<null | 'create' | 'join'>(null);
const [createName, setCreateName] = useState('');
const [createQuorum, setCreateQuorum] = useState(2);
const [createLoading, setCreateLoading] = useState(false);
const [createError, setCreateError] = useState<string | null>(null);
const [joinInput, setJoinInput] = useState('');
const [joinLoading, setJoinLoading] = useState(false);
const [joinError, setJoinError] = useState<string | null>(null);
```

Also add `useState` to the React import at line 2:
```typescript
import { useEffect, useRef, useState } from 'react';
```

**Step 2: Add handleCreate function**

After the existing `handleLeave` function (line 98), add:

```typescript
async function handleCreate() {
  setCreateLoading(true);
  setCreateError(null);
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quorum: createQuorum,
        lookAheadDays: state.preferences.lookAheadDays,
      }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const { sessionId: newSessionId, organizerToken } = await res.json();

    dispatch({ type: 'SET_SESSION', sessionId: newSessionId, organizerToken });

    const resolvedName = createName.trim() || `Group ${newSessionId}`;
    dispatch({
      type: 'ADD_GROUP',
      group: {
        sessionId: newSessionId,
        role: 'organizer',
        name: resolvedName,
        joinedAt: new Date().toISOString(),
      },
    });
    dispatch({ type: 'SET_ORGANIZER_TOKEN', sessionId: newSessionId, token: organizerToken });

    await fetch(`/api/sessions/${newSessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken: newSessionId, blocks: state.blocks }),
    });

    setCreateName('');
    setCreateQuorum(2);
    setActivePanel(null);
  } catch (err) {
    setCreateError(err instanceof Error ? err.message : 'Something went wrong.');
  } finally {
    setCreateLoading(false);
  }
}
```

**Step 3: Add handleJoin function**

After `handleCreate`, add:

```typescript
async function handleJoin() {
  const sessionId = parseSessionId(joinInput);
  if (!sessionId) {
    setJoinError('Please enter a valid join link or session ID.');
    return;
  }
  setJoinLoading(true);
  setJoinError(null);
  try {
    const validateRes = await fetch(`/api/sessions/${sessionId}/join`);
    if (!validateRes.ok) throw new Error('Session not found or expired.');

    const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken: sessionId, blocks: state.blocks }),
    });
    if (!joinRes.ok) {
      const d = await joinRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? 'Failed to join group.');
    }

    const { participantId } = await joinRes.json() as { participantId: string };
    dispatch({
      type: 'ADD_GROUP',
      group: {
        sessionId,
        role: 'participant',
        participantId,
        name: `Group ${sessionId}`,
        joinedAt: new Date().toISOString(),
      },
    });

    setJoinInput('');
    setActivePanel(null);
  } catch (err) {
    setJoinError(err instanceof Error ? err.message : 'Failed to join group.');
  } finally {
    setJoinLoading(false);
  }
}
```

**Step 4: Replace the bottom section of the JSX**

The current JSX ends with (lines 164–186):
```tsx
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sessions/new"
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Plan with a group
            </Link>
            {state.sessionId && (
              <Link
                href={`/sessions/${state.sessionId}/view`}
                className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Share my availability →
              </Link>
            )}
          </div>
        </>
      )}
      <GroupsList
        groups={state.groups}
        onRename={handleRename}
        onLeave={handleLeave}
      />
```

Replace with:
```tsx
          {state.sessionId && (
            <div className="mt-4">
              <Link
                href={`/sessions/${state.sessionId}/view`}
                className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Share my availability →
              </Link>
            </div>
          )}
        </>
      )}

      {/* Inline create / join panel */}
      <div className="mt-8">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setActivePanel(activePanel === 'create' ? null : 'create'); setCreateError(null); }}
            className={`text-sm border rounded-lg px-3 py-1.5 transition-colors ${activePanel === 'create' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            + Create a new group
          </button>
          <button
            onClick={() => { setActivePanel(activePanel === 'join' ? null : 'join'); setJoinError(null); }}
            className={`text-sm border rounded-lg px-3 py-1.5 transition-colors ${activePanel === 'join' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            Join a group
          </button>
        </div>

        {activePanel === 'create' && (
          <div className="border rounded-xl p-4 mb-4 bg-gray-50">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Group name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Team standup sync"
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                maxLength={80}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                How many people need to be free?
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={createQuorum}
                onChange={(e) => setCreateQuorum(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="border rounded-lg px-3 py-2 w-24 text-sm bg-white"
              />
            </div>
            {createError && <p className="text-sm text-red-600 mb-3">{createError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createLoading ? 'Creating…' : 'Create session'}
              </button>
              <button
                onClick={() => setActivePanel(null)}
                className="border rounded-lg px-4 py-2 text-sm hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activePanel === 'join' && (
          <div className="border rounded-xl p-4 mb-4 bg-gray-50">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Paste join link or session ID
              </label>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="https://…/sessions/ABC123/join  or  ABC123"
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
              />
            </div>
            {joinError && <p className="text-sm text-red-600 mb-3">{joinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleJoin}
                disabled={joinLoading || !joinInput.trim()}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {joinLoading ? 'Joining…' : 'Join group'}
              </button>
              <button
                onClick={() => setActivePanel(null)}
                className="border rounded-lg px-4 py-2 text-sm hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <GroupsList
        groups={state.groups}
        onRename={handleRename}
        onLeave={handleLeave}
      />
```

**Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass

**Step 6: Start dev server and visually verify**

```bash
npx next dev --port 3001
```

Check in browser:
- Availability page loads without error
- "Create a new group" button toggles the create form open/closed
- "Join a group" button toggles the join form open/closed
- Opening one panel collapses the other (they toggle independently — that's fine; both can be open at once or you can make them exclusive by checking the toggle logic)
- Create form: fill name + quorum, submit → group appears in list below, panel closes
- Join form: paste a session join URL → group appears in list, panel closes
- Empty join input → "Join group" button is disabled
- Groups list appears below the panel with all per-group actions intact
- "Share my availability →" link still appears when sessionId exists (populated state only)
- Empty state (no blocks): toggle buttons still visible, groups list still visible

**Step 7: Commit**

```bash
git add src/app/availability/page.tsx
git commit -m "feat: add inline create/join group panel to availability tab"
```

---

### Task 4: Remove empty-state link to /sessions/new

The empty state currently has a "Schedule with open availability →" link to `/sessions/new`. That page still exists but the inline panel makes it redundant from the empty state.

**Files:**
- Modify: `src/app/availability/page.tsx`

**Step 1: Find and remove the link**

In the empty state block (currently around lines 130–151), find:
```tsx
<Link
  href="/sessions/new"
  className="text-sm text-gray-500 hover:text-gray-700 underline"
>
  Schedule with open availability →
</Link>
```

Remove it entirely. The "Connect a calendar" CTA stays. The inline create panel below handles group creation.

**Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass

**Step 3: Commit**

```bash
git add src/app/availability/page.tsx
git commit -m "feat: remove redundant sessions/new link from availability empty state"
```
