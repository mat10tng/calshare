# UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Implement all UX improvements from the audit design doc — plain language copy, clearer landing page, better calendar import layout, welcoming join flow, personal availability sharing view, and mobile improvements.

**Architecture:** Pure UI/copy changes across 6 pages + one new page. No API changes. Changes are backward-compatible and isolated per page. Follow the approved design doc at `docs/plans/2026-03-09-ux-audit-design.md`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4

---

## Task 1: Replace Jargon With Plain Language

**Files:**
- Modify: `src/app/sessions/new/page.tsx:63-76`
- Modify: `src/app/sessions/[id]/join/page.tsx:95-108`
- Modify: `src/app/sessions/[id]/page.tsx:81-114`
- Modify: `src/app/availability/page.tsx:115-116`

**No unit tests needed** — these are copy-only changes with no logic.

**Step 1: Update sessions/new label and help text**

In `src/app/sessions/new/page.tsx`, change:

```tsx
// BEFORE (line 63-76):
<label className="block text-sm font-medium mb-2">
  Minimum free participants (quorum)
</label>
// ...
<p className="text-xs text-gray-400 mt-1">
  Only show slots where at least {quorum} participant{quorum !== 1 ? 's are' : ' is'} free.
</p>

// AFTER:
<label className="block text-sm font-medium mb-2">
  How many people need to be free?
</label>
// ...
<p className="text-xs text-gray-400 mt-1">
  Only show times where at least {quorum} {quorum !== 1 ? 'people are' : 'person is'} available.
</p>
```

**Step 2: Update join page button and status text**

In `src/app/sessions/[id]/join/page.tsx`, change:

```tsx
// BEFORE (line 97, 106):
<p className="text-sm font-medium text-green-800">Ready to submit</p>
<p className="text-sm text-green-700">
  {state.blocks.filter((b) => b.busy).length} anonymised busy blocks from your calendar.
  No event details included.
</p>
// ...
{submitting ? 'Submitting…' : 'Submit my availability'}

// AFTER:
<p className="text-sm font-medium text-green-800">Ready to share</p>
<p className="text-sm text-green-700">
  {state.blocks.filter((b) => b.busy).length} busy times from your calendar (details hidden).
  No event titles or descriptions shared.
</p>
// ...
{submitting ? 'Sharing…' : 'Share my free times'}
```

**Step 3: Update organizer view heading**

In `src/app/sessions/[id]/page.tsx`, change:

```tsx
// BEFORE (line 111-114):
<h2 className="text-base font-semibold mb-3">
  Common free slots
  {freeSlots.length === 0 && ' — none found with current quorum'}
</h2>

// AFTER:
<h2 className="text-base font-semibold mb-3">
  Times that work for everyone
  {freeSlots.length === 0 && ' — none found yet'}
</h2>
```

**Step 4: Update availability dashboard busy block count text**

In `src/app/availability/page.tsx`, change:

```tsx
// BEFORE (line 115-116):
Showing {state.blocks.filter((b) => b.busy).length} busy blocks across{' '}
{state.preferences.lookAheadDays} days

// AFTER:
Showing {state.blocks.filter((b) => b.busy).length} busy times across the next{' '}
{state.preferences.lookAheadDays} days
```

**Step 5: Commit**

```bash
git add src/app/sessions/new/page.tsx src/app/sessions/[id]/join/page.tsx src/app/sessions/[id]/page.tsx src/app/availability/page.tsx
git commit -m "ux: replace jargon with plain language throughout"
```

---

## Task 2: Landing Page — Two Feature Cards

**Files:**
- Modify: `src/app/page.tsx`

**No unit tests needed** — pure layout change.

**Step 1: Replace the two buttons with two feature cards**

Replace the entire `<div className="flex flex-wrap gap-4 justify-center mb-16">` section (lines 18-31) with two cards side by side (stacked on mobile):

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16 text-left">
  <div className="border-2 border-gray-100 rounded-2xl p-6 hover:border-blue-200 transition-colors">
    <p className="text-3xl mb-3">📅</p>
    <h2 className="text-lg font-bold mb-2">Share my schedule</h2>
    <p className="text-sm text-gray-600 mb-5">
      Generate a link that shows when you&apos;re free — privately. No event details shared.
    </p>
    <Link
      href="/availability/connect"
      className="inline-block bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
    >
      Get started →
    </Link>
  </div>

  <div className="border-2 border-gray-100 rounded-2xl p-6 hover:border-blue-200 transition-colors">
    <p className="text-3xl mb-3">👥</p>
    <h2 className="text-lg font-bold mb-2">Plan with a group</h2>
    <p className="text-sm text-gray-600 mb-5">
      Find a time that works for everyone. Invite friends with one link — no accounts needed.
    </p>
    <Link
      href="/sessions/new"
      className="inline-block border-2 border-gray-800 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
    >
      Create session →
    </Link>
  </div>
</div>
```

Keep the three feature cards below unchanged.

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "ux: replace landing page buttons with feature cards"
```

---

## Task 3: Calendar Import — File Upload to Primary Section

**Files:**
- Modify: `src/app/availability/connect/page.tsx`

**No unit tests needed** — reordering existing sections with cosmetic changes.

**Step 1: Reorder sections — file upload first, OAuth second**

Currently the page has:
1. "Import from file" section (lines 126-180)
2. "Sync via account" section (lines 182-206)
3. Skip link (lines 208-213)

**Restructure so the layout reads top-to-bottom as:**
1. File upload section (with bigger drop zone and "Upload a file" heading)
2. "Or connect instantly" divider + OAuth buttons
3. Skip link

Replace the main content (after the privacy disclaimer, before the AnonymisationPreview modals) with:

```tsx
{/* Primary: File upload */}
<section className="mb-8">
  <h2 className="text-base font-semibold mb-3">Upload a file</h2>
  <div className="flex flex-col gap-2 mb-4">
    <a
      href="https://calendar.google.com/calendar/r/settings/export"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg">📅</span>
      <span>Export from Google Calendar →</span>
    </a>
    <a
      href="https://outlook.live.com/calendar/0/options/calendar/SharedCalendars"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg">📧</span>
      <span>Export from Outlook.com (personal) →</span>
    </a>
    <a
      href="https://outlook.office.com/calendar/0/options/calendar/SharedCalendars"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg">🏢</span>
      <span>Export from Microsoft 365 (work/school) →</span>
    </a>
  </div>
  <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
    <span className="text-3xl">📂</span>
    <span className="text-sm font-medium text-gray-700 text-center">
      {loading ? 'Processing…' : (
        <>
          Drop your .ics or .zip file here<br />
          <span className="text-gray-400 font-normal">or click to browse</span>
        </>
      )}
    </span>
    <input
      type="file"
      accept=".ics,.zip"
      className="sr-only"
      onChange={handleIcsUpload}
      disabled={loading}
    />
  </label>
  {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
  <p className="text-sm text-gray-400 mt-2 text-center">
    Need step-by-step help?{' '}
    <button onClick={() => setShowGuide(true)} className="text-blue-600 underline hover:text-blue-700">
      See export guide
    </button>
  </p>
</section>

{/* Secondary: OAuth */}
<div className="relative flex items-center mb-6">
  <div className="flex-1 border-t border-gray-200" />
  <span className="px-3 text-xs text-gray-400">or connect instantly</span>
  <div className="flex-1 border-t border-gray-200" />
</div>

<section className="mb-6">
  <div className="flex flex-col gap-2">
    <button
      onClick={handleGoogleConnect}
      disabled={loading}
      className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <span className="text-lg">📅</span>
      <span>Continue with Google</span>
    </button>
    <button
      onClick={handleMicrosoftConnect}
      disabled={loading}
      className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <span className="text-lg">📧</span>
      <span>Continue with Microsoft / Outlook</span>
    </button>
  </div>
</section>

<p className="text-center text-sm text-gray-400 mt-2">
  No calendar to share?{' '}
  <Link href="/availability" className="text-blue-600 hover:underline">
    Skip — I&apos;m available whenever
  </Link>
</p>
```

**Step 2: Commit**

```bash
git add src/app/availability/connect/page.tsx
git commit -m "ux: promote file upload to primary section on calendar import page"
```

---

## Task 4: Join Flow — Welcome Screen With Context

**Files:**
- Modify: `src/app/sessions/[id]/join/page.tsx`

**No unit tests needed** — copy and layout change.

**Step 1: Update the main return JSX**

Replace the main return block (currently lines 64-110) with:

```tsx
return (
  <main className="max-w-md mx-auto py-12 px-4">
    <h1 className="text-2xl font-bold mb-3">You&apos;ve been invited to find a time together</h1>
    <p className="text-sm text-gray-600 mb-6">
      Add your free times and the organiser can see when everyone can meet —
      without seeing your calendar details.
    </p>

    {sessionInfo && (
      <p className="text-xs text-gray-400 mb-4">
        Looking ahead {sessionInfo.lookAheadDays} days
      </p>
    )}

    {error && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
        {error}
      </div>
    )}

    {state.blocks.length === 0 ? (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-blue-800">ℹ️ No calendar connected — you&apos;ll be marked as free</p>
        <p className="text-sm text-blue-700 mt-1">
          <Link
            href={`/availability/connect?returnTo=/sessions/${sessionId}/join`}
            className="underline font-medium"
          >
            Add your calendar first →
          </Link>
        </p>
      </div>
    ) : (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-green-800">✅ Calendar connected</p>
        <p className="text-sm text-green-700 mt-1">
          {state.blocks.filter((b) => b.busy).length} busy times found (details hidden).
        </p>
      </div>
    )}

    <button
      onClick={submitBlocks}
      disabled={submitting}
      className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {submitting ? 'Sharing…' : 'Share my free times'}
    </button>

    <p className="text-center text-xs text-gray-400 mt-4">
      🔒 No account needed. No event details shared.
    </p>
  </main>
);
```

**Step 2: Commit**

```bash
git add "src/app/sessions/[id]/join/page.tsx"
git commit -m "ux: add welcoming context and privacy reassurance to join page"
```

---

## Task 5: Personal Availability — Share Button + Public View Page

This task adds a "Share my availability" button to the availability dashboard and creates the public read-only view page that recipients see.

**Files:**
- Modify: `src/app/availability/page.tsx` — add share button
- Create: `src/app/sessions/[id]/view/page.tsx` — new public view page

**Background:** The `/api/sessions/[id]/public` endpoint already exists and returns `{ sessionId, lookAheadDays, blocks }` for the organizer's blocks. The `sessionId` is stored in `state.sessionId` after auto-creation on the availability page.

**Step 1: Add "Share my availability" button to the availability dashboard**

In `src/app/availability/page.tsx`, after the existing `<div className="mt-6 flex gap-3">` block that contains "Schedule with a group" (line 124-131), add a share button that links to the public view:

```tsx
// Change the mt-6 div to include both buttons:
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
```

**Step 2: Create the public view page**

Create `src/app/sessions/[id]/view/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

interface PublicData {
  sessionId: string;
  lookAheadDays: number;
  blocks: BusyBlock[];
}

export default function PublicAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const res = await fetch(`/api/sessions/${p.id}/public`);
        if (!res.ok) throw new Error('Not found');
        setData(await res.json());
      } catch {
        setError('This availability link has expired or does not exist.');
      }
    });
  }, [params]);

  if (error) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-gray-400 text-sm">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + data.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  const busyCount = data.blocks.filter((b) => b.busy).length;

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">Availability</h1>
      <p className="text-sm text-gray-500 mb-8">
        Next {data.lookAheadDays} days · {busyCount} busy times (event details hidden)
      </p>

      <AvailabilityGrid
        blocks={data.blocks}
        fromDate={now}
        toDate={until}
        {/* Read-only: no onBlocksChange prop */}
      />

      <div className="mt-10 pt-8 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-600 mb-3">Want to find a time together?</p>
        <Link
          href="/sessions/new"
          className="inline-block bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Create a group session →
        </Link>
      </div>
    </main>
  );
}
```

Note: `AvailabilityGrid` without the `onBlocksChange` prop is already read-only (the drag handler checks for the callback before invoking it).

**Step 3: Verify by running the dev server**

```bash
npm run dev
```

Navigate to `/availability` → import a calendar → check that "Share my availability →" button appears → click it → verify the public view loads with the grid and free slot summary.

**Step 4: Commit**

```bash
git add src/app/availability/page.tsx "src/app/sessions/[id]/view/page.tsx"
git commit -m "feat: add personal availability sharing — share button and public view page"
```

---

## Task 6: Mobile UX — Tap Targets and Full-Width Buttons

**Files:**
- Modify: `src/app/sessions/[id]/page.tsx` — bigger copy button
- Modify: `src/app/layout.tsx` — confirm viewport meta tag exists
- Modify: `src/app/sessions/new/page.tsx` — min text size on number input

**Step 1: Check viewport meta in layout**

Read `src/app/layout.tsx` and confirm `<meta name="viewport" content="width=device-width, initial-scale=1" />` is present. Next.js App Router includes this by default in the `<html>` element, but verify it's not overridden.

**Step 2: Make the organizer view copy button more prominent**

In `src/app/sessions/[id]/page.tsx`, update the invite link section (lines 90-103):

```tsx
{/* Invite link */}
<div className="bg-gray-50 rounded-xl p-4 mb-8">
  <p className="text-sm font-semibold mb-3">Invite link — share this with your group</p>
  <div className="flex gap-2 items-stretch">
    <code className="flex-1 text-xs bg-white border rounded-lg px-3 py-2.5 break-all self-center">
      {joinLink || '…'}
    </code>
    <button
      onClick={copyLink}
      className="text-sm border rounded-lg px-4 py-2.5 hover:bg-white transition-colors whitespace-nowrap font-medium min-h-[44px]"
    >
      {copied ? '✓ Copied' : 'Copy link'}
    </button>
  </div>
</div>
```

**Step 3: Fix number input text size on session create page (prevents iOS zoom)**

In `src/app/sessions/new/page.tsx`, update the number input class to ensure 16px minimum:

```tsx
// BEFORE:
className="border rounded-lg px-3 py-2 w-full text-sm"

// AFTER:
className="border rounded-lg px-3 py-2 w-full text-base"
```

(`text-base` = 16px in Tailwind — prevents iOS from zooming in on focus)

**Step 4: Commit**

```bash
git add src/app/sessions/[id]/page.tsx src/app/sessions/new/page.tsx
git commit -m "ux: improve mobile tap targets and prevent iOS input zoom"
```

---

## Verification Checklist

After all tasks complete, verify these scenarios manually in a browser:

- [ ] Landing page: two cards visible side by side on desktop, stacked on mobile (375px)
- [ ] Landing page: each card has its own CTA that routes to the correct page
- [ ] Calendar import: file export links and drop zone appear at top; OAuth buttons below the divider
- [ ] Calendar import: drop zone is large and has icon + multi-line text
- [ ] Join page: welcome heading visible, privacy line at bottom, button says "Share my free times"
- [ ] Sessions new: label reads "How many people need to be free?" not "quorum"
- [ ] Organizer view: heading says "Times that work for everyone"
- [ ] Availability dashboard: "Share my availability →" link visible when calendar imported
- [ ] Public view (`/sessions/[id]/view`): loads grid, shows busy count, has CTA at bottom
- [ ] Public view: editing is disabled (no drag changes anything)
- [ ] All buttons on join page are full-width
- [ ] Copy button on organizer view is minimum 44px tall
- [ ] Number input on sessions/new doesn't cause zoom on iOS (16px text)
