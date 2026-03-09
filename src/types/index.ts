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
