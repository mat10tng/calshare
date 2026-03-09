# Use Case: Privacy-First Calendar Availability Merger

**Document version:** 0.1 — Draft
**Date:** 2026-03-09
**Author:** Tuan

---

## 1. Overview

Friends and colleagues who juggle demanding work schedules and personal lives often struggle to find shared free time — not because it doesn't exist, but because coordinating across multiple calendar sources (work Outlook, personal Google Calendar, etc.) is tedious and privacy-sensitive. Nobody wants to share the details of their personal appointments just to find a meeting slot.

This app solves that by allowing each person to import their calendars, merge them into a single anonymised **"busy/free"** view, and share only that sanitised availability — never the underlying event details.

---

## 2. Problem Statement

- People maintain calendars across multiple platforms (Microsoft Outlook for work, Google Calendar for personal use).
- Manually cross-referencing these to find free slots is time-consuming.
- Sharing raw calendar data exposes sensitive personal or professional information.
- Group scheduling (3+ people) compounds both problems.
- Individuals also want to control which hours of the day they are *willing* to be booked, regardless of technical availability.

---

## 3. Goals

| # | Goal |
|---|------|
| G1 | Allow users to import calendar data from Outlook and Google Calendar |
| G2 | Merge multiple personal calendars into a single busy/free view per user |
| G3 | Never store or transmit raw event details — only anonymised time blocks |
| G4 | Allow users to define their own availability windows (e.g. "not before 9am", "not on weekends") |
| G5 | Support group scheduling: merge multiple users' availability to surface common free slots |
| G6 | Export a combined availability result that can be shared safely |

---

## 4. Users & Roles

### 4.1 Individual User
A person who wants to manage and share their own availability without disclosing calendar details.

### 4.2 Group Organiser
A person (also an Individual User) who initiates a group scheduling session, invites others, and views the merged group availability.

### 4.3 Group Participant
An Individual User who joins a group session and contributes their availability.

---

## 5. Key User Stories

### Calendar Import
- **US-01** — As a user, I want to connect my Outlook work calendar via OAuth so my busy times are imported automatically.
- **US-02** — As a user, I want to connect my Google Calendar via OAuth so my personal busy times are imported.
- **US-03** — As a user, I want to import calendar data from an `.ics` file as an alternative to OAuth, for calendars that don't support direct integration.
- **US-04** — As a user, I want to choose *which* calendars (from a connected account) to include, so I can exclude irrelevant ones (e.g. public holidays only).

### Privacy & Anonymisation
- **US-05** — As a user, I want all event titles, descriptions, and attendees stripped before any data is used or shared, so no personal information ever leaves my device unprotected.
- **US-06** — As a user, I want confirmation that raw event data is never stored on any server — only processed in-session or locally.

### Availability Preferences
- **US-07** — As a user, I want to define my working hours (e.g. Mon–Fri, 9am–6pm) so I am never shown as available outside those hours.
- **US-08** — As a user, I want to block out certain recurring periods (e.g. "never book me on Friday afternoons") that override my calendar.
- **US-09** — As a user, I want to set a minimum buffer time between appointments (e.g. 30 min gap).
- **US-10** — As a user, I want to specify a look-ahead window (e.g. next 2 weeks) for availability queries.

### Group Scheduling
- **US-11** — As a group organiser, I want to create a scheduling session and invite others by link or email.
- **US-12** — As a group participant, I want to join a session and contribute my anonymised busy/free blocks without sharing my calendar details.
- **US-13** — As a group organiser, I want to see a merged view showing time slots where all (or a configurable number of) participants are free.
- **US-14** — As a group organiser, I want to filter results by minimum slot duration (e.g. only show slots of 1 hour or longer).

### Export & Sharing
- **US-15** — As a user, I want to export my merged availability as a shareable link that shows only free/busy blocks.
- **US-16** — As a user, I want to export availability as an `.ics` file or PDF summary.
- **US-17** — As a group organiser, I want to export the group's common free slots as a summary.

---

## 6. Functional Requirements

### 6.1 Calendar Integration
- OAuth 2.0 connection to **Microsoft Graph API** (Outlook / Microsoft 365)
- OAuth 2.0 connection to **Google Calendar API**
- `.ics` file import as a fallback
- Support for multiple connected accounts per user

### 6.2 Data Anonymisation Engine
- On import, strip all event fields except: **start datetime**, **end datetime**, **all-day flag**, **busy/free status**
- Apply anonymisation before any data leaves the local context or is stored
- Raw calendar data must never be persisted; only the derived busy-block array is retained

### 6.3 Availability Preference Engine
- UI for defining working hours per day of week
- UI for defining blocked recurring windows
- Buffer time setting (in minutes)
- Look-ahead window setting (in days)
- Preferences stored locally per user profile

### 6.4 Merge Engine
- Combine multiple busy-block arrays (from multiple calendars or users) into a unified timeline
- Compute free slots from the inverse of merged busy blocks, constrained by availability preferences
- Support configurable quorum for group sessions (e.g. "find slots where at least 3 of 5 are free")

### 6.5 Group Session Management
- Create/join sessions via shareable token
- Session stores only anonymised busy blocks per participant, keyed by a random participant ID (no name/email required unless organiser chooses to label slots)
- Sessions expire after a configurable period (default: 7 days)

### 6.6 Export
- Shareable read-only link showing free/busy grid
- `.ics` export of free slots
- PDF or plain-text summary of top N suggested meeting slots

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Privacy** | No raw event data stored server-side; only anonymised time blocks |
| **Security** | OAuth tokens encrypted at rest; sessions use short-lived tokens |
| **Performance** | Availability merge for a 14-day window across 5 users in < 2 seconds |
| **Compatibility** | Web-first; responsive for mobile; optional PWA |
| **Accessibility** | WCAG 2.1 AA compliance |
| **Data Retention** | Group session data auto-deleted after session expiry; user preferences stored locally by default |

---

## 8. Privacy Design Principles

This app is built **privacy-first** by design:

1. **Minimum data collection** — Only time ranges (start/end) and busy status are ever processed. No event names, locations, attendees, or descriptions.
2. **Local-first processing** — Calendar data is fetched and anonymised client-side before any network transmission.
3. **No account required** — Users can operate without creating an account; preferences and tokens are stored in the browser/device only.
4. **Ephemeral group sessions** — Group scheduling sessions are temporary and contain no PII.
5. **Explicit consent** — Users confirm which calendars to include each session, with a clear explanation of what data is processed.
6. **Right to disconnect** — Users can revoke OAuth access and clear all local data at any time.

---

## 9. Out of Scope (v1)

- Sending meeting invites or booking slots directly from the app
- Native mobile apps (iOS/Android) — web-first only
- Integration with calendars beyond Outlook and Google (e.g. Apple Calendar, Calendly) — future versions
- AI-suggested optimal meeting times — future versions
- Two-way calendar sync or writing events back to calendar providers

---

## 10. Assumptions & Constraints

- Users must grant OAuth permissions to their calendar providers; the app cannot function without read access.
- The app operates within the rate limits of the Microsoft Graph and Google Calendar APIs.
- Users are assumed to be in different or mixed time zones; the app must handle timezone conversion correctly.
- Initial target: small groups of 2–10 people.

---

## 11. Success Metrics

- A user can connect both calendars and view their merged availability in under **3 minutes**.
- A group of 5 people can complete a scheduling session (invite → contribute → view results) in under **10 minutes**.
- Zero raw event data is transmitted or stored — verifiable via network inspection.
- User satisfaction: ease-of-use rating of 4/5 or above in early testing.

---

## 12. Suggested Technical Stack (Initial Thinking)

| Layer | Options |
|---|---|
| **Frontend** | React + TypeScript, Tailwind CSS |
| **Calendar APIs** | Microsoft Graph API, Google Calendar API |
| **Anonymisation** | Client-side JS (runs in browser before any transmission) |
| **Backend (minimal)** | Node.js / Edge Functions — only for session token management and relay |
| **Storage** | LocalStorage / IndexedDB for user prefs; ephemeral in-memory for group sessions |
| **Auth** | OAuth 2.0 PKCE flow (no server-side token storage) |
| **Export** | ics.js for `.ics` generation; jsPDF for PDF |

---

*This document is a living draft intended to guide early app design and development conversations.*
