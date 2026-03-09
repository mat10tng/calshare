# Architecture Design: Privacy-First Calendar Availability Merger

**Document version:** 1.0
**Date:** 2026-03-09
**Status:** Approved

---

## 1. Chosen Stack

| Layer | Decision |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| Session storage | Vercel KV (Redis, ephemeral) |
| Calendar parsing | `ical.js` (`.ics`), Microsoft Graph API, Google Calendar API |
| OAuth | PKCE — client-side only, no server-side token storage |
| Export | `ics.js` (`.ics`), `jsPDF` (PDF) |

---

## 2. Overall Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                    │
│                                                          │
│  ┌──────────────┐   ┌─────────────────┐  ┌──────────┐  │
│  │ OAuth PKCE   │   │ Anonymisation   │  │  Merge   │  │
│  │ (MS / Google)│──▶│ Engine          │──▶│  Engine  │  │
│  └──────────────┘   │ (strips to      │  │          │  │
│                     │  start/end/busy) │  └────┬─────┘  │
│  ┌──────────────┐   └─────────────────┘       │        │
│  │ .ics Upload  │──▶  (same engine)            │        │
│  └──────────────┘                             │        │
│                                               │        │
│  ┌──────────────┐                             │        │
│  │ Export Guide │   ┌──────────────────┐      │        │
│  │ (Path C)     │──▶│  LocalStorage /  │      │        │
│  └──────────────┘   │  IndexedDB       │      │        │
│                     │  (prefs, tokens) │      │        │
│  ┌──────────────┐   └──────────────────┘      │        │
│  │ Availability │◀──────────────────────────── ┘        │
│  │ Preferences  │                                        │
│  └──────────────┘                                        │
└───────────────────────┬──────────────────────────────────┘
                        │ Only anonymised busy blocks
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel (Next.js API Routes)                 │
│                                                          │
│  POST   /api/sessions              → create session     │
│  POST   /api/sessions/[id]/participants → submit blocks │
│  GET    /api/sessions/[id]         → fetch all blocks   │
│  DELETE /api/sessions/[id]         → manual expiry      │
│  GET    /api/sessions/[id]/join    → public join info   │
│                                                          │
│  Storage: Vercel KV — TTL 7 days, anonymised data only  │
└─────────────────────────────────────────────────────────┘
```

**Core privacy invariant:** The server only ever receives anonymised `{start, end, busy, allDay}` arrays keyed by a random participant ID. No names, emails, event titles, OAuth tokens, or raw calendar data ever reach the server.

---

## 3. Calendar Data Ingestion (Three Paths)

### Path A: OAuth PKCE
- User connects Google or Outlook via PKCE flow (no client secret, runs entirely in browser)
- Access token stored in React state (memory only — gone on page refresh)
- Refresh tokens not stored (user re-authenticates each session — privacy-aligned)
- Events fetched directly from provider API, passed immediately to Anonymisation Engine

### Path B: Manual `.ics` Import
- User uploads an `.ics` file
- Parsed entirely client-side with `ical.js` — zero network calls
- Events passed to the same Anonymisation Engine as Path A — identical output

### Path C: One-Click Export Guide
- Step-by-step modal guiding user to export `.ics` from Outlook or Google Calendar themselves
- No OAuth, no credentials — user exports manually, then uploads via Path B
- Designed for users who cannot or will not grant OAuth access to work calendars

All three paths produce identical output and feed into the same downstream pipeline.

---

## 4. Anonymisation Engine + Transparency UI

### Data transformation

```
Raw event (any provider):              Anonymised block:
{                                      {
  id, title, description,       →        start: ISO string (UTC),
  attendees, location,                   end:   ISO string (UTC),
  organizer, status, ...                 busy:  boolean,
}                                        allDay: boolean
                                       }
```

**Rules:**
- Strip all fields except `start`, `end`, `status`, `allDay`
- Tentative events treated as busy (conservative)
- All-day events mark entire day busy
- All datetimes normalised to UTC
- Processing is a pure synchronous function — no side effects, no network

### Anonymisation Preview (mandatory UX step)

After every calendar connection (any path), the user sees an explicit preview **before** any data proceeds:

```
┌─────────────────────────────────────────────────────┐
│  Your calendar data has been anonymised             │
│                                                     │
│  What we REMOVED:          What we KEPT:            │
│  ✕ Event titles            ✓ Start time             │
│  ✕ Descriptions            ✓ End time               │
│  ✕ Attendees               ✓ Busy / Free            │
│  ✕ Locations                                        │
│  ✕ Organiser                                        │
│                                                     │
│  Preview (this is ALL we see):                      │
│  ┌────────────────────────────────────────────┐     │
│  │ Mon 10 Mar  09:00 – 10:00   busy           │     │
│  │ Mon 10 Mar  13:00 – 14:30   busy           │     │
│  │ Tue 11 Mar  (all day)       busy           │     │
│  │ ...                                        │     │
│  └────────────────────────────────────────────┘     │
│                                                     │
│  Raw event data is never stored or transmitted.     │
│  [ Continue ]  [ Cancel & disconnect ]              │
└─────────────────────────────────────────────────────┘
```

- User must explicitly click **Continue** — no silent processing
- Preview is rendered from the anonymised array (raw events already discarded)
- Applies to all three ingestion paths
- Shows the look-ahead window in use

---

## 5. Frontend Architecture

### Route structure

```
app/
├── page.tsx                        → Landing / home
├── availability/
│   ├── page.tsx                    → Personal availability dashboard
│   ├── connect/
│   │   └── page.tsx                → Calendar connection (OAuth or .ics)
│   └── preferences/
│       └── page.tsx                → Working hours, buffers, blocked windows
├── sessions/
│   ├── new/page.tsx                → Create group session
│   ├── [id]/page.tsx               → Organiser view (merged availability grid)
│   └── [id]/join/page.tsx          → Participant join + contribute flow
└── export/
    └── [id]/page.tsx               → Read-only shareable availability view
```

All pages are `"use client"` — App Router used for routing only, no SSR.

### Key components

| Component | Responsibility |
|---|---|
| `CalendarConnector` | OAuth PKCE flow or `.ics` upload; emits anonymised blocks |
| `IcsGuide` | Step-by-step export guide modal (Path C) |
| `AnonymisationEngine` | Pure function: raw events → `{start, end, busy, allDay}[]` |
| `AnonymisationPreview` | Transparency UI — shows what was stripped, requires explicit confirm |
| `PreferencesEditor` | Working hours grid, buffer slider, look-ahead picker |
| `AvailabilityGrid` | Visual free/busy timeline (week view, 30-min slots) |
| `MergeEngine` | Client-side: intersects busy arrays, applies preferences, computes free slots |
| `SessionManager` | Create/join session, POST blocks to API, poll for participant updates |
| `ExportPanel` | `.ics` download, PDF summary, shareable link |

### State management

React Context + `useReducer` — no external state library. Single top-level context holds:
- Anonymised busy blocks per connected calendar
- User preferences (also persisted to `localStorage`)
- Active session state

---

## 6. Group Session Backend

### API surface

```
POST   /api/sessions
  Body:    { lookAheadDays: number, quorum: number, expiryDays?: number }
  Returns: { sessionId: string, organizerToken: string }

POST   /api/sessions/[id]/participants
  Body:    { participantToken: string, blocks: BusyBlock[] }
  Returns: { participantId: string }

GET    /api/sessions/[id]
  Auth:    Bearer <organizerToken>
  Returns: { participants: { id: string, blocks: BusyBlock[] }[], quorum, lookAheadDays }

DELETE /api/sessions/[id]
  Auth:    Bearer <organizerToken>
  Returns: 204

GET    /api/sessions/[id]/join
  Public — no auth required
  Returns: { sessionId, lookAheadDays }
```

### Vercel KV data shape

```
session:{id} → {
  organizerToken: string,     // bcrypt hashed
  quorum: number,
  lookAheadDays: number,
  createdAt: ISO string,
  participants: {
    [participantId: string]: BusyBlock[]
  }
}
TTL: 7 days (auto-expiry via KV TTL)
```

### Security

- `sessionId` — random 12-char token (public, used in join link)
- `organizerToken` — random 32-char token, stored hashed (bcrypt), required to read/delete session
- `participantToken` — included in join link, validates the correct session
- No PII stored at any point — only anonymised time blocks

### Join flow

1. Organiser creates session → shareable link: `app.com/sessions/[id]/join?t=[participantToken]`
2. Participant opens link, runs anonymisation locally, POSTs blocks
3. Organiser polls `GET /api/sessions/[id]`, runs MergeEngine client-side to compute common free slots

---

## 7. OAuth + Calendar Integration

### PKCE flow (both providers)

```
1. User clicks "Connect Google / Outlook"
2. App generates code_verifier + code_challenge (SHA-256, client-side)
3. Redirect to provider OAuth consent screen
4. Provider redirects to app/availability/connect?code=...
5. App exchanges code + code_verifier for access_token (no client_secret)
6. Token stored in React state (memory only)
7. Fetch events → anonymise immediately → token discarded after session
```

### Provider configuration

| Provider | App type | Scopes |
|---|---|---|
| Google | Web app (public client) | `calendar.events.readonly` |
| Microsoft | SPA (PKCE public client) | `Calendars.Read` |

### SDKs

- Google: `@react-oauth/google` + raw `fetch` to Calendar API
- Microsoft: `@azure/msal-browser` + `@microsoft/microsoft-graph-client`

---

## 8. Export & Sharing

| Format | Personal | Group session | Generated |
|---|---|---|---|
| Shareable link | Your free/busy grid | Merged group availability | Server (read from KV) |
| `.ics` | Your free slots | Common free slots | Client-side (`ics.js`) |
| PDF summary | Your availability | Top N suggested slots | Client-side (`jsPDF`) |

- Shareable link auto-expires with session (7 days)
- `.ics` and PDF contain only free slot times — no event details, no participant info
- All export formats generated client-side where possible

---

## 9. Storage Summary

| Data | Where | Lifetime |
|---|---|---|
| OAuth access token | React state (memory) | Current session only |
| User preferences | `localStorage` | Until user clears |
| Anonymised busy blocks (personal) | React state | Current session only |
| Group session blocks | Vercel KV | 7 days (TTL) |
| Raw calendar events | Never stored | Discarded immediately after anonymisation |

---

## 10. Out of Scope (v1)

- Sending meeting invites or booking slots
- Native mobile apps
- Apple Calendar, Calendly integrations
- AI-suggested optimal times
- Two-way calendar sync
- Real-time WebSocket updates (polling is sufficient for v1)
