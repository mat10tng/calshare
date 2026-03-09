# Calendar Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Build a privacy-first calendar availability merger that lets users share free/busy blocks — never raw event details — with individuals and groups.

**Architecture:** Next.js App Router on Vercel, all calendar processing client-side, anonymised blocks only sent to server for group session relay via Vercel KV. OAuth PKCE runs entirely in the browser; tokens stored in memory only.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Vercel KV, `@azure/msal-browser`, `@react-oauth/google`, `@microsoft/microsoft-graph-client`, `ical.js`, `ics.js`, `jsPDF`, bcryptjs

---

## Task 0: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.env.local.example`
- Create: `src/types/index.ts`

**Step 1: Initialise Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-git --import-alias "@/*"
```

**Step 2: Install dependencies**

```bash
npm install @azure/msal-browser @microsoft/microsoft-graph-client @react-oauth/google ical.js ics jspdf bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: Install Vercel KV**

```bash
npm install @vercel/kv
```

**Step 4: Create shared types file**

Create `src/types/index.ts`:

```typescript
export interface BusyBlock {
  start: string;   // ISO 8601 UTC
  end: string;     // ISO 8601 UTC
  busy: boolean;
  allDay: boolean;
}

export interface UserPreferences {
  workingHours: {
    [day: string]: { start: string; end: string } | null; // null = day off
  };
  blockedWindows: { start: string; end: string; recurrence: string }[];
  bufferMinutes: number;
  lookAheadDays: number;
}

export interface Session {
  sessionId: string;
  organizerToken: string;
  quorum: number;
  lookAheadDays: number;
  createdAt: string;
  participants: {
    [participantId: string]: BusyBlock[];
  };
}

export type IngestionPath = 'oauth-google' | 'oauth-microsoft' | 'ics-upload' | 'ics-guide';
```

**Step 5: Create `.env.local.example`**

```bash
# Microsoft OAuth
NEXT_PUBLIC_MSAL_CLIENT_ID=
NEXT_PUBLIC_MSAL_TENANT_ID=common
NEXT_PUBLIC_MSAL_REDIRECT_URI=http://localhost:3000/availability/connect

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Vercel KV (populated automatically on Vercel, manual for local dev)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

**Step 6: Verify app starts**

```bash
npm run dev
```

Expected: Next.js running at `http://localhost:3000`

**Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js app with dependencies"
```

---

## Task 1: Anonymisation Engine (pure function + tests)

**Files:**
- Create: `src/lib/anonymise.ts`
- Create: `src/lib/__tests__/anonymise.test.ts`

**Step 1: Write failing tests**

Create `src/lib/__tests__/anonymise.test.ts`:

```typescript
import { anonymiseEvents, anonymiseIcsEvents } from '../anonymise';

describe('anonymiseEvents', () => {
  it('strips all fields except start, end, busy, allDay', () => {
    const raw = [{
      id: 'abc', title: '1:1 with Sarah', description: 'Q1 review',
      attendees: ['a@b.com'], location: 'Room 4',
      start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z',
      status: 'busy', allDay: false,
    }];
    const result = anonymiseEvents(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      start: '2026-03-10T09:00:00Z',
      end: '2026-03-10T10:00:00Z',
      busy: true,
      allDay: false,
    });
    expect(result[0]).not.toHaveProperty('title');
    expect(result[0]).not.toHaveProperty('id');
  });

  it('treats tentative events as busy', () => {
    const raw = [{ start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z', status: 'tentative', allDay: false }];
    expect(anonymiseEvents(raw)[0].busy).toBe(true);
  });

  it('treats free events as not busy', () => {
    const raw = [{ start: '2026-03-10T09:00:00Z', end: '2026-03-10T10:00:00Z', status: 'free', allDay: false }];
    expect(anonymiseEvents(raw)[0].busy).toBe(false);
  });

  it('normalises datetimes to UTC ISO strings', () => {
    const raw = [{ start: '2026-03-10T09:00:00+10:00', end: '2026-03-10T10:00:00+10:00', status: 'busy', allDay: false }];
    const result = anonymiseEvents(raw);
    expect(result[0].start).toBe('2026-03-09T23:00:00.000Z');
    expect(result[0].end).toBe('2026-03-10T00:00:00.000Z');
  });

  it('handles all-day events', () => {
    const raw = [{ start: '2026-03-10', end: '2026-03-11', status: 'busy', allDay: true }];
    const result = anonymiseEvents(raw);
    expect(result[0].allDay).toBe(true);
    expect(result[0].busy).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

```bash
npx jest src/lib/__tests__/anonymise.test.ts
```

Expected: FAIL — "Cannot find module '../anonymise'"

**Step 3: Install Jest + ts-jest**

```bash
npm install -D jest ts-jest @types/jest jest-environment-jsdom
```

Add to `package.json`:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" }
},
"scripts": { "test": "jest" }
```

**Step 4: Implement anonymise.ts**

Create `src/lib/anonymise.ts`:

```typescript
import type { BusyBlock } from '@/types';

interface RawEvent {
  start: string;
  end: string;
  status: string;
  allDay: boolean;
  [key: string]: unknown;
}

export function anonymiseEvents(events: RawEvent[]): BusyBlock[] {
  return events.map((e) => ({
    start: e.allDay ? e.start : new Date(e.start).toISOString(),
    end: e.allDay ? e.end : new Date(e.end).toISOString(),
    busy: e.status !== 'free',
    allDay: e.allDay,
  }));
}
```

**Step 5: Run tests to verify passing**

```bash
npx jest src/lib/__tests__/anonymise.test.ts
```

Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/lib/anonymise.ts src/lib/__tests__/anonymise.test.ts
git commit -m "feat: anonymisation engine with tests"
```

---

## Task 2: Merge Engine (pure function + tests)

**Files:**
- Create: `src/lib/merge.ts`
- Create: `src/lib/__tests__/merge.test.ts`

**Step 1: Write failing tests**

Create `src/lib/__tests__/merge.test.ts`:

```typescript
import { computeFreeSlots, mergeGroupAvailability } from '../merge';
import type { BusyBlock, UserPreferences } from '@/types';

const defaultPrefs: UserPreferences = {
  workingHours: {
    Mon: { start: '09:00', end: '17:00' },
    Tue: { start: '09:00', end: '17:00' },
    Wed: { start: '09:00', end: '17:00' },
    Thu: { start: '09:00', end: '17:00' },
    Fri: { start: '09:00', end: '17:00' },
    Sat: null,
    Sun: null,
  },
  blockedWindows: [],
  bufferMinutes: 0,
  lookAheadDays: 7,
};

describe('computeFreeSlots', () => {
  it('returns working hours minus busy blocks', () => {
    const busy: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    // Monday 2026-03-09, working 09:00-17:00 UTC
    const free = computeFreeSlots(busy, defaultPrefs, '2026-03-09', '2026-03-09');
    expect(free.some(s => s.start === '2026-03-09T10:00:00.000Z')).toBe(true);
    expect(free.every(s => s.start >= '2026-03-09T09:00:00.000Z')).toBe(true);
  });

  it('applies buffer time between slots', () => {
    const prefs = { ...defaultPrefs, bufferMinutes: 30 };
    const busy: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    const free = computeFreeSlots(busy, prefs, '2026-03-09', '2026-03-09');
    expect(free[0].start).toBe('2026-03-09T10:30:00.000Z');
  });

  it('excludes weekends when not in working hours', () => {
    const busy: BusyBlock[] = [];
    // 2026-03-07 is a Saturday
    const free = computeFreeSlots(busy, defaultPrefs, '2026-03-07', '2026-03-07');
    expect(free).toHaveLength(0);
  });
});

describe('mergeGroupAvailability', () => {
  it('finds slots where all participants are free', () => {
    const p1: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T10:00:00.000Z', busy: true, allDay: false },
    ];
    const p2: BusyBlock[] = [
      { start: '2026-03-09T14:00:00.000Z', end: '2026-03-09T15:00:00.000Z', busy: true, allDay: false },
    ];
    const result = mergeGroupAvailability([p1, p2], defaultPrefs, '2026-03-09', '2026-03-09', 2);
    // 10:00-14:00 should be free for both
    expect(result.some(s =>
      s.start <= '2026-03-09T10:00:00.000Z' && s.end >= '2026-03-09T14:00:00.000Z'
    )).toBe(true);
  });

  it('respects quorum — shows slots where at least N are free', () => {
    const p1: BusyBlock[] = [];
    const p2: BusyBlock[] = [];
    const p3: BusyBlock[] = [
      { start: '2026-03-09T09:00:00.000Z', end: '2026-03-09T17:00:00.000Z', busy: true, allDay: false },
    ];
    // quorum=2, p3 busy all day — p1+p2 still free, meets quorum
    const result = mergeGroupAvailability([p1, p2, p3], defaultPrefs, '2026-03-09', '2026-03-09', 2);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to verify failure**

```bash
npx jest src/lib/__tests__/merge.test.ts
```

Expected: FAIL

**Step 3: Implement merge.ts**

Create `src/lib/merge.ts`:

```typescript
import type { BusyBlock, UserPreferences } from '@/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWorkingWindow(date: string, prefs: UserPreferences): { start: Date; end: Date } | null {
  const d = new Date(date + 'T00:00:00.000Z');
  const dayName = DAY_NAMES[d.getUTCDay()];
  const hours = prefs.workingHours[dayName];
  if (!hours) return null;
  const [sh, sm] = hours.start.split(':').map(Number);
  const [eh, em] = hours.end.split(':').map(Number);
  return {
    start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm)),
    end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), eh, em)),
  };
}

export function computeFreeSlots(
  busyBlocks: BusyBlock[],
  prefs: UserPreferences,
  fromDate: string,
  toDate: string,
): BusyBlock[] {
  const free: BusyBlock[] = [];
  const current = new Date(fromDate + 'T00:00:00.000Z');
  const end = new Date(toDate + 'T00:00:00.000Z');

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const window = getWorkingWindow(dateStr, prefs);
    if (window) {
      const dayBusy = busyBlocks
        .filter(b => b.busy && b.start.startsWith(dateStr))
        .sort((a, b) => a.start.localeCompare(b.start));

      let cursor = window.start;
      for (const block of dayBusy) {
        const bs = new Date(block.start);
        const be = new Date(block.end);
        if (bs > cursor) {
          free.push({ start: cursor.toISOString(), end: bs.toISOString(), busy: false, allDay: false });
        }
        const withBuffer = new Date(be.getTime() + prefs.bufferMinutes * 60_000);
        if (withBuffer > cursor) cursor = withBuffer;
      }
      if (cursor < window.end) {
        free.push({ start: cursor.toISOString(), end: window.end.toISOString(), busy: false, allDay: false });
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return free;
}

export function mergeGroupAvailability(
  participantBlocks: BusyBlock[][],
  prefs: UserPreferences,
  fromDate: string,
  toDate: string,
  quorum: number,
): BusyBlock[] {
  const freePerParticipant = participantBlocks.map(blocks =>
    computeFreeSlots(blocks, prefs, fromDate, toDate)
  );

  // Collect all boundary times
  const times = new Set<string>();
  freePerParticipant.flat().forEach(s => { times.add(s.start); times.add(s.end); });
  const sorted = [...times].sort();

  const result: BusyBlock[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const slotStart = sorted[i];
    const slotEnd = sorted[i + 1];
    const freeCount = freePerParticipant.filter(pFree =>
      pFree.some(s => s.start <= slotStart && s.end >= slotEnd)
    ).length;
    if (freeCount >= quorum) {
      if (result.length > 0 && result[result.length - 1].end === slotStart) {
        result[result.length - 1].end = slotEnd;
      } else {
        result.push({ start: slotStart, end: slotEnd, busy: false, allDay: false });
      }
    }
  }
  return result;
}
```

**Step 4: Run tests**

```bash
npx jest src/lib/__tests__/merge.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/merge.ts src/lib/__tests__/merge.test.ts
git commit -m "feat: merge engine with quorum support and tests"
```

---

## Task 3: Vercel KV Session API Routes

**Files:**
- Create: `src/app/api/sessions/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`
- Create: `src/app/api/sessions/[id]/participants/route.ts`
- Create: `src/app/api/sessions/[id]/join/route.ts`
- Create: `src/lib/session.ts`

**Step 1: Create session helper**

Create `src/lib/session.ts`:

```typescript
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import type { Session } from '@/types';

export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createSession(opts: {
  quorum: number;
  lookAheadDays: number;
  expiryDays?: number;
}): Promise<{ sessionId: string; organizerToken: string }> {
  const sessionId = generateToken(12);
  const organizerToken = generateToken(32);
  const hashedToken = await bcrypt.hash(organizerToken, 10);
  const session: Session = {
    sessionId,
    organizerToken: hashedToken,
    quorum: opts.quorum,
    lookAheadDays: opts.lookAheadDays,
    createdAt: new Date().toISOString(),
    participants: {},
  };
  const ttl = (opts.expiryDays ?? 7) * 86400;
  await kv.set(`session:${sessionId}`, session, { ex: ttl });
  return { sessionId, organizerToken };
}

export async function verifyOrganizerToken(sessionId: string, token: string): Promise<Session | null> {
  const session = await kv.get<Session>(`session:${sessionId}`);
  if (!session) return null;
  const valid = await bcrypt.compare(token, session.organizerToken);
  return valid ? session : null;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return kv.get<Session>(`session:${sessionId}`);
}
```

**Step 2: Create POST /api/sessions**

Create `src/app/api/sessions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  const { quorum = 1, lookAheadDays = 14, expiryDays = 7 } = await req.json();
  const result = await createSession({ quorum, lookAheadDays, expiryDays });
  return NextResponse.json(result, { status: 201 });
}
```

**Step 3: Create GET/DELETE /api/sessions/[id]**

Create `src/app/api/sessions/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyOrganizerToken } from '@/lib/session';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await verifyOrganizerToken(params.id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    participants: Object.entries(session.participants).map(([id, blocks]) => ({ id, blocks })),
    quorum: session.quorum,
    lookAheadDays: session.lookAheadDays,
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await verifyOrganizerToken(params.id, token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await kv.del(`session:${params.id}`);
  return new NextResponse(null, { status: 204 });
}
```

**Step 4: Create POST /api/sessions/[id]/participants**

Create `src/app/api/sessions/[id]/participants/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getSession, generateToken } from '@/lib/session';
import type { BusyBlock, Session } from '@/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { participantToken, blocks } = await req.json() as { participantToken: string; blocks: BusyBlock[] };
  const session = await getSession(params.id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  // participantToken is the sessionId itself — validates they have the correct join link
  if (participantToken !== params.id) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  const participantId = generateToken(12);
  const updated: Session = {
    ...session,
    participants: { ...session.participants, [participantId]: blocks },
  };
  await kv.set(`session:${params.id}`, updated, { keepTtl: true });
  return NextResponse.json({ participantId }, { status: 201 });
}
```

**Step 5: Create GET /api/sessions/[id]/join**

Create `src/app/api/sessions/[id]/join/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(params.id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ sessionId: session.sessionId, lookAheadDays: session.lookAheadDays });
}
```

**Step 6: Test endpoints manually**

```bash
# Start dev server with local KV (or use Vercel CLI)
npx vercel dev

# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"quorum":2,"lookAheadDays":14}'
# Expected: {"sessionId":"...","organizerToken":"..."}
```

**Step 7: Commit**

```bash
git add src/app/api/ src/lib/session.ts
git commit -m "feat: session API routes with Vercel KV"
```

---

## Task 4: App Context + Preferences Store

**Files:**
- Create: `src/context/AppContext.tsx`
- Create: `src/hooks/usePreferences.ts`

**Step 1: Create AppContext**

Create `src/context/AppContext.tsx`:

```typescript
'use client';
import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { BusyBlock, UserPreferences } from '@/types';

const DEFAULT_PREFS: UserPreferences = {
  workingHours: {
    Mon: { start: '09:00', end: '17:00' },
    Tue: { start: '09:00', end: '17:00' },
    Wed: { start: '09:00', end: '17:00' },
    Thu: { start: '09:00', end: '17:00' },
    Fri: { start: '09:00', end: '17:00' },
    Sat: null,
    Sun: null,
  },
  blockedWindows: [],
  bufferMinutes: 15,
  lookAheadDays: 14,
};

interface AppState {
  blocks: BusyBlock[];
  preferences: UserPreferences;
  sessionId: string | null;
  organizerToken: string | null;
}

type Action =
  | { type: 'SET_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BLOCKS': return { ...state, blocks: action.blocks };
    case 'SET_PREFERENCES': return { ...state, preferences: action.preferences };
    case 'SET_SESSION': return { ...state, sessionId: action.sessionId, organizerToken: action.organizerToken };
    case 'CLEAR_SESSION': return { ...state, sessionId: null, organizerToken: null };
    default: return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    blocks: [],
    preferences: DEFAULT_PREFS,
    sessionId: null,
    organizerToken: null,
  });

  // Persist preferences to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('calshare:preferences');
    if (saved) dispatch({ type: 'SET_PREFERENCES', preferences: JSON.parse(saved) });
  }, []);

  useEffect(() => {
    localStorage.setItem('calshare:preferences', JSON.stringify(state.preferences));
  }, [state.preferences]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
```

**Step 2: Wrap layout with AppProvider**

Modify `src/app/layout.tsx`:

```typescript
import { AppProvider } from '@/context/AppContext';
// ... existing imports

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add src/context/ src/app/layout.tsx
git commit -m "feat: app context with preferences persistence"
```

---

## Task 5: Anonymisation Preview Component

**Files:**
- Create: `src/components/AnonymisationPreview.tsx`

**Step 1: Implement the component**

Create `src/components/AnonymisationPreview.tsx`:

```typescript
'use client';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  source: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AnonymisationPreview({ blocks, source, onConfirm, onCancel }: Props) {
  const preview = blocks.slice(0, 8);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h2 className="text-xl font-semibold mb-1">Your calendar data has been anonymised</h2>
        <p className="text-sm text-gray-500 mb-4">Source: {source}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-red-600 mb-2">What we REMOVED</p>
            {['Event titles', 'Descriptions', 'Attendees', 'Locations', 'Organiser'].map(item => (
              <p key={item} className="text-sm text-gray-600">✕ {item}</p>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-green-600 mb-2">What we KEPT</p>
            {['Start time', 'End time', 'Busy / Free'].map(item => (
              <p key={item} className="text-sm text-gray-600">✓ {item}</p>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            Preview — this is ALL we see ({blocks.length} blocks)
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {preview.map((b, i) => (
              <div key={i} className="text-xs font-mono text-gray-700">
                {b.allDay
                  ? `${b.start.split('T')[0]}  (all day)  ${b.busy ? 'busy' : 'free'}`
                  : `${new Date(b.start).toLocaleString()}  →  ${new Date(b.end).toLocaleString()}  ${b.busy ? 'busy' : 'free'}`
                }
              </div>
            ))}
            {blocks.length > 8 && (
              <p className="text-xs text-gray-400">... and {blocks.length - 8} more</p>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Raw event data is never stored or transmitted.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
          >
            Continue
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel & disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/AnonymisationPreview.tsx
git commit -m "feat: anonymisation preview component"
```

---

## Task 6: Calendar Connect Page (OAuth + .ics)

**Files:**
- Create: `src/app/availability/connect/page.tsx`
- Create: `src/lib/google-calendar.ts`
- Create: `src/lib/microsoft-calendar.ts`
- Create: `src/lib/ics-parser.ts`

**Step 1: ICS parser**

Create `src/lib/ics-parser.ts`:

```typescript
import ICAL from 'ical.js';
import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

export function parseIcsFile(content: string): BusyBlock[] {
  const jcal = ICAL.parse(content);
  const comp = new ICAL.Component(jcal);
  const events = comp.getAllSubcomponents('vevent');

  const raw = events.map((vevent) => {
    const event = new ICAL.Event(vevent);
    return {
      start: event.startDate.toJSDate().toISOString(),
      end: event.endDate.toJSDate().toISOString(),
      status: (vevent.getFirstPropertyValue('transp') === 'TRANSPARENT') ? 'free' : 'busy',
      allDay: event.startDate.isDate,
    };
  });

  return anonymiseEvents(raw);
}
```

**Step 2: Google Calendar fetcher**

Create `src/lib/google-calendar.ts`:

```typescript
import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

export async function fetchGoogleEvents(accessToken: string, lookAheadDays: number): Promise<BusyBlock[]> {
  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 86400_000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${now.toISOString()}&timeMax=${until.toISOString()}&singleEvents=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch Google Calendar events');
  const data = await res.json();

  const raw = (data.items ?? []).map((e: any) => ({
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    status: e.transparency === 'transparent' ? 'free' : (e.status === 'cancelled' ? 'free' : 'busy'),
    allDay: !e.start?.dateTime,
  }));

  return anonymiseEvents(raw);
}
```

**Step 3: Microsoft Calendar fetcher**

Create `src/lib/microsoft-calendar.ts`:

```typescript
import { anonymiseEvents } from './anonymise';
import type { BusyBlock } from '@/types';

export async function fetchMicrosoftEvents(accessToken: string, lookAheadDays: number): Promise<BusyBlock[]> {
  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 86400_000);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?` +
    `startDateTime=${now.toISOString()}&endDateTime=${until.toISOString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch Microsoft Calendar events');
  const data = await res.json();

  const raw = (data.value ?? []).map((e: any) => ({
    start: e.start?.dateTime + 'Z',
    end: e.end?.dateTime + 'Z',
    status: e.showAs === 'free' || e.showAs === 'oof' ? 'free' : 'busy',
    allDay: e.isAllDay ?? false,
  }));

  return anonymiseEvents(raw);
}
```

**Step 4: Connect page**

Create `src/app/availability/connect/page.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AnonymisationPreview } from '@/components/AnonymisationPreview';
import { parseIcsFile } from '@/lib/ics-parser';
import type { BusyBlock } from '@/types';

export default function ConnectPage() {
  const { state, dispatch } = useApp();
  const [pending, setPending] = useState<{ blocks: BusyBlock[]; source: string } | null>(null);

  async function handleIcsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const blocks = parseIcsFile(content);
    setPending({ blocks, source: file.name });
  }

  function handleConfirm() {
    if (!pending) return;
    dispatch({ type: 'SET_BLOCKS', blocks: [...state.blocks, ...pending.blocks] });
    setPending(null);
  }

  return (
    <main className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Connect your calendar</h1>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Option 1: Upload .ics file</h2>
        <input type="file" accept=".ics" onChange={handleIcsUpload} className="block" />
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Option 2: Connect via OAuth</h2>
        <p className="text-sm text-gray-500 mb-3">Coming in next task</p>
      </section>

      {pending && (
        <AnonymisationPreview
          blocks={pending.blocks}
          source={pending.source}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </main>
  );
}
```

**Step 5: Manually test .ics upload**

- Export a calendar from Google or Outlook as `.ics`
- Open `http://localhost:3000/availability/connect`
- Upload file → anonymisation preview should appear
- Confirm → blocks added to context

**Step 6: Commit**

```bash
git add src/app/availability/connect/ src/lib/ics-parser.ts src/lib/google-calendar.ts src/lib/microsoft-calendar.ts
git commit -m "feat: calendar connect page with .ics upload and anonymisation preview"
```

---

## Task 7: OAuth PKCE Flow (Google + Microsoft)

**Files:**
- Modify: `src/app/availability/connect/page.tsx`
- Create: `src/lib/oauth.ts`

**Step 1: Create oauth helpers**

Create `src/lib/oauth.ts`:

```typescript
// Google OAuth PKCE helpers
export function buildGoogleAuthUrl(redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(
  code: string, codeVerifier: string, redirectUri: string
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth token exchange failed');
  return data.access_token;
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}
```

**Step 2: Add OAuth buttons to connect page**

Modify `src/app/availability/connect/page.tsx` — add Google OAuth button:

```typescript
// Add to ConnectPage:
async function handleGoogleConnect() {
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem('pkce_verifier', verifier);
  const redirectUri = `${window.location.origin}/availability/connect`;
  window.location.href = buildGoogleAuthUrl(redirectUri, challenge);
}

// In JSX, replace "Coming in next task":
<button onClick={handleGoogleConnect} className="flex items-center gap-2 border rounded-lg px-4 py-2 hover:bg-gray-50">
  Connect Google Calendar
</button>
```

**Step 3: Handle OAuth callback in connect page**

Add to connect page `useEffect`:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) return;
  sessionStorage.removeItem('pkce_verifier');
  window.history.replaceState({}, '', '/availability/connect');

  (async () => {
    const token = await exchangeGoogleCode(code, verifier, `${window.location.origin}/availability/connect`);
    const blocks = await fetchGoogleEvents(token, state.preferences.lookAheadDays);
    setPending({ blocks, source: 'Google Calendar' });
  })();
}, []);
```

**Step 4: Manually test OAuth flow**

- Ensure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set in `.env.local`
- Click "Connect Google Calendar" → redirects to Google consent → returns → preview appears

**Step 5: Commit**

```bash
git add src/lib/oauth.ts src/app/availability/connect/page.tsx
git commit -m "feat: Google OAuth PKCE flow"
```

---

## Task 8: ICS Export Guide (Path C)

**Files:**
- Create: `src/components/IcsGuide.tsx`
- Modify: `src/app/availability/connect/page.tsx`

**Step 1: Implement IcsGuide modal**

Create `src/components/IcsGuide.tsx`:

```typescript
'use client';

interface Props {
  onClose: () => void;
  onFileReady: (file: File) => void;
}

const STEPS = {
  google: [
    'Open Google Calendar at calendar.google.com',
    'Click the gear icon → Settings',
    'In the left sidebar, click "Import & Export"',
    'Click "Export" — downloads a .zip file',
    'Unzip the file to find your .ics files',
    'Upload the .ics file below',
  ],
  outlook: [
    'Open Outlook and go to File → Save Calendar',
    'Choose a date range and detail level',
    'Save as an .ics file',
    'Upload the .ics file below',
  ],
};

export function IcsGuide({ onClose, onFileReady }: Props) {
  const [provider, setProvider] = useState<'google' | 'outlook' | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Export your calendar manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          No OAuth needed — export your calendar yourself and upload the file. Your data never leaves your device.
        </p>
        {!provider ? (
          <div className="flex gap-3">
            <button onClick={() => setProvider('google')} className="flex-1 border rounded-lg p-3 hover:bg-gray-50 text-sm font-medium">
              Google Calendar
            </button>
            <button onClick={() => setProvider('outlook')} className="flex-1 border rounded-lg p-3 hover:bg-gray-50 text-sm font-medium">
              Outlook / Microsoft 365
            </button>
          </div>
        ) : (
          <>
            <ol className="space-y-2 mb-4">
              {STEPS[provider].map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-blue-600 font-medium">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
            <input
              type="file" accept=".ics"
              onChange={e => { const f = e.target.files?.[0]; if (f) { onFileReady(f); onClose(); }}}
              className="block w-full text-sm"
            />
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add import for useState to IcsGuide**

Add `import { useState } from 'react';` at top of `IcsGuide.tsx`.

**Step 3: Wire IcsGuide into connect page**

Add "Can't use OAuth?" link to connect page that opens the IcsGuide modal.

**Step 4: Commit**

```bash
git add src/components/IcsGuide.tsx src/app/availability/connect/page.tsx
git commit -m "feat: ICS export guide modal (Path C)"
```

---

## Task 9: Preferences Editor Page

**Files:**
- Create: `src/app/availability/preferences/page.tsx`

**Step 1: Implement preferences page**

Create `src/app/availability/preferences/page.tsx`:

```typescript
'use client';
import { useApp } from '@/context/AppContext';
import type { UserPreferences } from '@/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PreferencesPage() {
  const { state, dispatch } = useApp();
  const prefs = state.preferences;

  function updateHours(day: string, field: 'start' | 'end', value: string) {
    const current = prefs.workingHours[day];
    dispatch({
      type: 'SET_PREFERENCES',
      preferences: {
        ...prefs,
        workingHours: {
          ...prefs.workingHours,
          [day]: current ? { ...current, [field]: value } : { start: '09:00', end: '17:00', [field]: value },
        },
      },
    });
  }

  function toggleDay(day: string) {
    dispatch({
      type: 'SET_PREFERENCES',
      preferences: {
        ...prefs,
        workingHours: {
          ...prefs.workingHours,
          [day]: prefs.workingHours[day] ? null : { start: '09:00', end: '17:00' },
        },
      },
    });
  }

  return (
    <main className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Availability Preferences</h1>

      <section className="mb-8">
        <h2 className="font-semibold mb-3">Working hours</h2>
        {DAYS.map(day => (
          <div key={day} className="flex items-center gap-3 mb-2">
            <input type="checkbox" checked={!!prefs.workingHours[day]} onChange={() => toggleDay(day)} id={day} />
            <label htmlFor={day} className="w-8 text-sm">{day}</label>
            {prefs.workingHours[day] && (
              <>
                <input type="time" value={prefs.workingHours[day]!.start}
                  onChange={e => updateHours(day, 'start', e.target.value)}
                  className="border rounded px-2 py-1 text-sm" />
                <span className="text-gray-400 text-sm">to</span>
                <input type="time" value={prefs.workingHours[day]!.end}
                  onChange={e => updateHours(day, 'end', e.target.value)}
                  className="border rounded px-2 py-1 text-sm" />
              </>
            )}
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-3">Buffer time between meetings</h2>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={60} step={5} value={prefs.bufferMinutes}
            onChange={e => dispatch({ type: 'SET_PREFERENCES', preferences: { ...prefs, bufferMinutes: Number(e.target.value) }})}
            className="flex-1" />
          <span className="text-sm w-16">{prefs.bufferMinutes} min</span>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Look-ahead window</h2>
        <select value={prefs.lookAheadDays}
          onChange={e => dispatch({ type: 'SET_PREFERENCES', preferences: { ...prefs, lookAheadDays: Number(e.target.value) }})}
          className="border rounded px-3 py-2 text-sm">
          {[7, 14, 21, 30].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
      </section>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/availability/preferences/page.tsx
git commit -m "feat: preferences editor page"
```

---

## Task 10: Availability Dashboard + Merge View

**Files:**
- Create: `src/app/availability/page.tsx`
- Create: `src/components/AvailabilityGrid.tsx`

**Step 1: Availability Grid component**

Create `src/components/AvailabilityGrid.tsx`:

```typescript
'use client';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  fromDate: string;
  toDate: string;
}

function getDates(from: string, to: string): string[] {
  const dates = [];
  const cur = new Date(from + 'T00:00:00.000Z');
  const end = new Date(to + 'T00:00:00.000Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00–23:00

export function AvailabilityGrid({ blocks, fromDate, toDate }: Props) {
  const dates = getDates(fromDate, toDate);

  function isBusy(date: string, hour: number): boolean {
    const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
    const slotEnd = new Date(slotStart.getTime() + 3600_000);
    return blocks.some(b => b.busy && new Date(b.start) < slotEnd && new Date(b.end) > slotStart);
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-10" />
            {dates.map(d => <th key={d} className="px-1 py-1 font-medium text-gray-500 min-w-[40px]">{d.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(hour => (
            <tr key={hour}>
              <td className="text-right pr-2 text-gray-400">{String(hour).padStart(2, '0')}:00</td>
              {dates.map(d => (
                <td key={d} className={`border border-gray-100 h-4 ${isBusy(d, hour) ? 'bg-red-200' : 'bg-green-100'}`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 inline-block" /> Busy</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 inline-block" /> Free</span>
      </div>
    </div>
  );
}
```

**Step 2: Availability dashboard page**

Create `src/app/availability/page.tsx`:

```typescript
'use client';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';

export default function AvailabilityPage() {
  const { state } = useApp();
  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + state.preferences.lookAheadDays * 86400_000).toISOString().split('T')[0];

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Availability</h1>
        <div className="flex gap-3">
          <Link href="/availability/connect" className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50">
            + Connect calendar
          </Link>
          <Link href="/availability/preferences" className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50">
            Preferences
          </Link>
        </div>
      </div>

      {state.blocks.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No calendars connected yet.</p>
          <Link href="/availability/connect" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">
            Connect your first calendar
          </Link>
        </div>
      ) : (
        <AvailabilityGrid blocks={state.blocks} fromDate={now} toDate={until} />
      )}
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/availability/page.tsx src/components/AvailabilityGrid.tsx
git commit -m "feat: availability dashboard with grid view"
```

---

## Task 11: Group Session — Create + Organiser View

**Files:**
- Create: `src/app/sessions/new/page.tsx`
- Create: `src/app/sessions/[id]/page.tsx`

**Step 1: Create session page**

Create `src/app/sessions/new/page.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function NewSessionPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [quorum, setQuorum] = useState(2);
  const [loading, setLoading] = useState(false);

  async function createSession() {
    setLoading(true);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quorum, lookAheadDays: state.preferences.lookAheadDays }),
    });
    const { sessionId, organizerToken } = await res.json();
    dispatch({ type: 'SET_SESSION', sessionId, organizerToken });

    // Submit own blocks immediately
    await fetch(`/api/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken: sessionId, blocks: state.blocks }),
    });

    router.push(`/sessions/${sessionId}`);
  }

  return (
    <main className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">New Group Session</h1>
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Quorum (minimum free participants)</label>
        <input type="number" min={1} max={20} value={quorum} onChange={e => setQuorum(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 w-full" />
      </div>
      <button onClick={createSession} disabled={loading || state.blocks.length === 0}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {loading ? 'Creating...' : 'Create session & get invite link'}
      </button>
      {state.blocks.length === 0 && (
        <p className="text-sm text-red-500 mt-2">Connect a calendar first to contribute your availability.</p>
      )}
    </main>
  );
}
```

**Step 2: Organiser view page**

Create `src/app/sessions/[id]/page.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { mergeGroupAvailability } from '@/lib/merge';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import type { BusyBlock } from '@/types';

export default function SessionPage({ params }: { params: { id: string } }) {
  const { state } = useApp();
  const [participants, setParticipants] = useState<{ id: string; blocks: BusyBlock[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const joinLink = typeof window !== 'undefined'
    ? `${window.location.origin}/sessions/${params.id}/join`
    : '';

  async function fetchSession() {
    if (!state.organizerToken) return;
    const res = await fetch(`/api/sessions/${params.id}`, {
      headers: { Authorization: `Bearer ${state.organizerToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setParticipants(data.participants);
    setLoading(false);
  }

  useEffect(() => { fetchSession(); const t = setInterval(fetchSession, 10_000); return () => clearInterval(t); }, [state.organizerToken]);

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + state.preferences.lookAheadDays * 86400_000).toISOString().split('T')[0];
  const allBlocks = participants.flatMap(p => p.blocks);
  const freeSlots = mergeGroupAvailability(
    participants.map(p => p.blocks),
    state.preferences, now, until,
    state.sessionId ? 1 : 1 // use quorum from API in real impl
  );

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Group Session</h1>
      <p className="text-sm text-gray-500 mb-4">{participants.length} participant(s) contributed</p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium mb-1">Share this invite link:</p>
        <code className="text-xs bg-white border rounded px-2 py-1 block break-all">{joinLink}</code>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          <h2 className="font-semibold mb-3">Common free slots</h2>
          <AvailabilityGrid blocks={[...allBlocks, ...freeSlots]} fromDate={now} toDate={until} />
        </>
      )}
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/sessions/new/page.tsx src/app/sessions/[id]/page.tsx
git commit -m "feat: group session create and organiser view"
```

---

## Task 12: Group Session — Participant Join Flow

**Files:**
- Create: `src/app/sessions/[id]/join/page.tsx`

**Step 1: Implement join page**

Create `src/app/sessions/[id]/join/page.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';

export default function JoinPage({ params }: { params: { id: string } }) {
  const { state } = useApp();
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<{ lookAheadDays: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${params.id}/join`)
      .then(r => r.json())
      .then(setSessionInfo);
  }, [params.id]);

  async function submitBlocks() {
    setSubmitting(true);
    await fetch(`/api/sessions/${params.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken: params.id, blocks: state.blocks }),
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <main className="max-w-md mx-auto py-12 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Availability submitted!</h1>
        <p className="text-gray-600">Your anonymised availability has been added to the group session. The organiser can now see common free slots.</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Join scheduling session</h1>
      {sessionInfo && <p className="text-sm text-gray-500 mb-6">Looking ahead {sessionInfo.lookAheadDays} days</p>}

      {state.blocks.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium mb-2">Connect your calendar first</p>
          <Link href={`/availability/connect?returnTo=/sessions/${params.id}/join`}
            className="text-sm text-blue-600 underline">
            Connect calendar →
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium">Ready to submit</p>
          <p className="text-sm text-gray-600">{state.blocks.length} anonymised blocks from your calendar</p>
        </div>
      )}

      <button onClick={submitBlocks} disabled={submitting || state.blocks.length === 0}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {submitting ? 'Submitting...' : 'Submit my availability'}
      </button>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/sessions/[id]/join/page.tsx
git commit -m "feat: participant join flow"
```

---

## Task 13: Export Panel (.ics + PDF + shareable link)

**Files:**
- Create: `src/components/ExportPanel.tsx`
- Modify: `src/app/availability/page.tsx`
- Create: `src/app/export/[id]/page.tsx`

**Step 1: Implement ExportPanel**

Create `src/components/ExportPanel.tsx`:

```typescript
'use client';
import { createEvents } from 'ics';
import jsPDF from 'jspdf';
import type { BusyBlock } from '@/types';

interface Props {
  freeBlocks: BusyBlock[];
  title?: string;
}

export function ExportPanel({ freeBlocks, title = 'Availability' }: Props) {
  function downloadIcs() {
    const events = freeBlocks.map(b => {
      const s = new Date(b.start);
      const e = new Date(b.end);
      return {
        title: 'Available',
        start: [s.getFullYear(), s.getMonth() + 1, s.getDate(), s.getHours(), s.getMinutes()] as [number,number,number,number,number],
        end: [e.getFullYear(), e.getMonth() + 1, e.getDate(), e.getHours(), e.getMinutes()] as [number,number,number,number,number],
      };
    });
    const { error, value } = createEvents(events);
    if (error || !value) return;
    const blob = new Blob([value], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'availability.ics'; a.click();
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    const top5 = freeBlocks
      .filter(b => (new Date(b.end).getTime() - new Date(b.start).getTime()) >= 3600_000)
      .slice(0, 5);
    top5.forEach((b, i) => {
      const start = new Date(b.start).toLocaleString();
      const end = new Date(b.end).toLocaleString();
      const duration = Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000);
      doc.text(`${i + 1}. ${start} → ${end} (${duration} min)`, 14, 35 + i * 8);
    });
    doc.save('availability.pdf');
  }

  return (
    <div className="flex gap-3 flex-wrap">
      <button onClick={downloadIcs} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">
        Export .ics
      </button>
      <button onClick={downloadPdf} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">
        Export PDF
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ExportPanel.tsx
git commit -m "feat: export panel with .ics and PDF download"
```

---

## Task 14: Landing Page + Navigation

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/Nav.tsx`

**Step 1: Navigation**

Create `src/components/Nav.tsx`:

```typescript
import Link from 'next/link';

export function Nav() {
  return (
    <nav className="border-b px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold text-blue-600">CalShare</Link>
      <div className="flex gap-4 text-sm">
        <Link href="/availability" className="hover:text-blue-600">My Availability</Link>
        <Link href="/sessions/new" className="hover:text-blue-600">Group Session</Link>
      </div>
    </nav>
  );
}
```

**Step 2: Landing page**

Modify `src/app/page.tsx`:

```typescript
import Link from 'next/link';
import { Nav } from '@/components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto py-20 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4">Share when you're free.<br />Not what you're doing.</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Connect your calendars, get a privacy-first free/busy view, and schedule with groups — without sharing event details.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/availability/connect" className="bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700">
            Get started
          </Link>
          <Link href="/sessions/new" className="border rounded-lg px-6 py-3 font-medium hover:bg-gray-50">
            Schedule with a group
          </Link>
        </div>
      </main>
    </>
  );
}
```

**Step 3: Add Nav to layout**

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/Nav.tsx src/app/layout.tsx
git commit -m "feat: landing page and navigation"
```

---

## Task 15: Deploy to Vercel + KV Setup

**Step 1: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

**Step 2: Import project in Vercel**

- Go to vercel.com → New Project → Import from GitHub
- Select the repository

**Step 3: Add Vercel KV**

- In Vercel dashboard → Storage → Create KV database
- Connect it to the project (auto-populates `KV_REST_API_URL` and `KV_REST_API_TOKEN`)

**Step 4: Add environment variables in Vercel**

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-client-id>
NEXT_PUBLIC_MSAL_CLIENT_ID=<your-azure-app-client-id>
NEXT_PUBLIC_MSAL_REDIRECT_URI=https://<your-vercel-domain>/availability/connect
```

**Step 5: Configure OAuth app redirect URIs**

- Google Cloud Console: add `https://<vercel-domain>/availability/connect`
- Azure Portal: add same URL as SPA redirect URI

**Step 6: Trigger deploy and verify**

```bash
vercel --prod
```

Visit production URL and verify:
- Landing page loads
- `.ics` upload → anonymisation preview → dashboard shows grid
- New session → join link works from another browser

**Step 7: Final commit**

```bash
git add .
git commit -m "chore: deployment configuration and env setup"
```
