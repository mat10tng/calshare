# UX Audit & Redesign Design — 2026-03-09

## Goals

- Straightforward: reduce cognitive load across all flows
- User-centric: plain language, no jargon
- Easy to share with friends: frictionless join and personal sharing
- Everyone can use it: non-technical users, mobile-first, no account required

## Approach: Clearer Dual-Path (Approach B)

Keep both flows (personal availability sharing + group scheduling) but give each a clear identity. Simplify calendar import. Replace jargon with plain language. Improve the join experience for friends. Mobile-first throughout.

---

## Section 1 — Landing Page

**Problem:** Two equal CTAs with no descriptions. Non-tech users don't know which to pick.

**Solution:** Replace buttons with two feature cards, side-by-side (stacked on mobile).

```
┌──────────────────────┐  ┌──────────────────────┐
│ 📅 Share my schedule │  │ 👥 Plan with a group  │
│                      │  │                      │
│ Generate a link that  │  │ Find a time that     │
│ shows when you're    │  │ works for everyone.  │
│ free — privately.    │  │ Invite friends with  │
│                      │  │ one link.            │
│ [Get started →]      │  │ [Create session →]   │
└──────────────────────┘  └──────────────────────┘
```

- Each card: icon, 2-line description, own CTA button
- Cards stack vertically on mobile
- No more ambiguity about which flow to start

---

## Section 2 — Calendar Import (`/availability/connect`)

**Problem:** 5+ paths visible at once (Google OAuth, Microsoft OAuth, Google file, Outlook personal, Outlook work/school). Overwhelming. Manual file export is currently the dominant workflow.

**Solution:** File upload is the primary section (top), OAuth is secondary, Skip is at the bottom.

```
┌─── Upload a file ─────────────────────────────────┐
│  Export from: [Google] [Outlook personal]          │
│               [Outlook work/school]                │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Drop your .ics or .zip file here            │ │
│  │  or click to browse                          │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘

─── Or connect instantly ───────────────────────────
[G] Continue with Google
[M] Continue with Microsoft / Outlook

────────────────────────────────────────────────────
No calendar? [Skip — I'm available whenever →]
```

- Export guide links (all three variants) stay visible above the drop zone
- Drop zone is large and obvious
- OAuth is available but secondary
- Skip is clearly available at the bottom, not hidden

---

## Section 3 — Plain Language Copy

Replace all jargon with plain language throughout the app:

| Location | Current | Proposed |
|----------|---------|----------|
| `/sessions/new` | "Minimum free participants (quorum)" | "How many people need to be free?" |
| `/availability` | "Anonymised busy blocks" | "Your busy times (details hidden)" |
| `/availability/preferences` | "Look-ahead days: 14" | "Check the next 14 days" |
| `/availability/connect` (modal) | "Anonymisation preview" | "What we'll share about you" |
| `/sessions/[id]/join` | "Submit my availability" | "Share my free times" |
| `/sessions/[id]` | "Common free slots" | "Times that work for everyone" |

---

## Section 4 — Join Flow (`/sessions/[id]/join`)

**Problem:** Friends get a link, arrive at a blank page with just a button. No context, no warmth.

**Solution:** Welcome screen with context and privacy reassurance.

```
┌─────────────────────────────────────────────────────┐
│  You've been invited to find a time together        │
│                                                      │
│  Someone shared a scheduling link with you.         │
│  Add your free times and they'll see when           │
│  everyone can meet — without seeing your calendar.  │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Calendar connected — 12 busy times found  │   │
│  │    (or)                                      │   │
│  │ ℹ️  No calendar — you'll be marked as free   │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  [Add your calendar first →]   [Share my free times]│
│                                                      │
│  🔒 No account needed. No event details shared.     │
└─────────────────────────────────────────────────────┘
```

- Headline explains the purpose
- Body copy explains the privacy model in plain language
- Calendar status box (existing) stays
- Two clear actions: optional connect or immediate submit
- Privacy line at the bottom reassures hesitant users

---

## Section 5 — Personal Availability Sharing (Recipient View)

**Problem:** Recipients clicking a personal availability link get an unclear experience. The `/api/sessions/[id]/public` endpoint exists but there's no polished read-only view.

**Solution:** Clean read-only availability page for recipients.

```
┌─────────────────────────────────────────────────────┐
│  Alice's availability                               │
│  Next 14 days · Updated today                       │
│                                                      │
│  [Availability grid — read-only visual]             │
│                                                      │
│  Free on:                                           │
│  • Monday Mar 11 — morning free                     │
│  • Wednesday Mar 13 — afternoon free                │
│  • Friday Mar 15 — all day free                     │
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Want to find a time together?                      │
│  [Create a group session →]                         │
└─────────────────────────────────────────────────────┘
```

- Named, readable view with relative date context
- Summary list of free time windows (computed from blocks)
- Read-only grid visualization
- Optional CTA: "Create a group session" → natural upgrade path
- No account required to view

---

## Section 6 — Mobile & Accessibility

**Problem:** Drag-to-edit grid is hard on mobile. Small tap targets. No explicit accessibility support.

**Solutions:**

1. **Mobile grid editing**: On mobile, the availability grid is read-only. An "Edit times →" button opens a list view with per-slot toggles (no drag required)
2. **Copy button**: Minimum 44px tap target; moved to the top of the organizer view as a prominent action, not buried in a gray box
3. **Text sizing**: All body text minimum 16px to prevent iOS auto-zoom on input focus
4. **Full-width buttons on mobile**: Submit, Skip, Share my free times — all full-width on small screens
5. **Accessibility basics**: `aria-label` on icon-only buttons; free/busy states distinguished by both color AND pattern/text (not color alone)

---

## Implementation Priority

High impact, lower effort first:

1. **Copy changes** — rename all jargon to plain language (no UI changes needed)
2. **Landing page cards** — replace two buttons with two feature cards
3. **Join flow welcome screen** — add context, privacy line, improve layout
4. **Calendar import layout** — file upload to top, OAuth secondary
5. **Personal availability recipient view** — polish the public read-only page
6. **Mobile improvements** — edit mode toggle, tap targets, text sizing

---

## Success Criteria

- A non-technical user can import a calendar and share their availability in under 2 minutes
- A friend receiving a group invite link understands what they're being asked to do before clicking any button
- The app works correctly and looks good on a 375px mobile screen (iPhone SE)
- No jargon remains in any user-facing text
