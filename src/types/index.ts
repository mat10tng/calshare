export interface BusyBlock {
  start: string;   // ISO 8601 UTC
  end: string;     // ISO 8601 UTC
  busy: boolean;
  allDay: boolean;
  title?: string;  // optional — only included when user opts in
  sourceId?: string; // links to CalendarSource.id
}

export type CalendarCategory =
  | 'work'
  | 'personal'
  | 'fitness'
  | 'school'
  | 'family'
  | 'social';

export interface CalendarSource {
  id: string;                        // uuid generated at import time
  label: string;                     // "Google Calendar", "work.ics", etc.
  category: CalendarCategory | null; // null = user skipped
  addedAt: string;                   // ISO timestamp
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'none';

export interface UserPreferences {
  workingHours: {
    [day in Weekday]?: { start: string; end: string } | null;
  };
  blockedWindows: { start: string; end: string; recurrence: RecurrenceRule }[];
  bufferMinutes: number;
  lookAheadDays: number;
}

export interface Proposal {
  id: string;           // 8-char random token
  title: string;        // e.g. "Team lunch"
  createdBy: string;    // participantId
  createdAt: string;    // ISO timestamp
  votes: Record<string, string[]>; // participantId → array of "YYYY-MM-DD:H" cell keys
}

export interface Session {
  sessionId: string;
  type: 'personal' | 'group';
  name?: string;
  organizerToken: string;
  quorum: number;
  lookAheadDays: number;
  createdAt: string;
  participants: {
    [participantId: string]: BusyBlock[] | { personalSessionId: string };
  };
  proposals?: Proposal[];
}

export type IngestionPath = 'oauth-google' | 'oauth-microsoft' | 'ics-upload' | 'ics-guide';

export interface GroupEntry {
  sessionId: string;
  role: 'organizer' | 'participant';
  participantId?: string;   // participants only — used for block updates
  name: string;             // user's local label, editable anytime
  joinedAt: string;         // ISO timestamp
}
