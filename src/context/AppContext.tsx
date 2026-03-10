'use client';
import { createContext, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from 'react';
import type { BusyBlock, CalendarSource, UserPreferences, GroupEntry } from '@/types';

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
  sources: CalendarSource[];
  preferences: UserPreferences;
  sessionId: string | null;
  organizerToken: string | null;
  displayName: string | null;
  userColor: string | null;
  groups: GroupEntry[];
  organizerTokens: Record<string, string>;
}

type Action =
  | { type: 'IMPORT_CALENDAR'; source: CalendarSource; blocks: BusyBlock[] }
  | { type: 'SET_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'SET_SOURCES'; sources: CalendarSource[] }
  | { type: 'ADD_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'CLEAR_BLOCKS' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'ADD_GROUP'; group: GroupEntry }
  | { type: 'UPDATE_GROUP'; sessionId: string; changes: Partial<GroupEntry> }
  | { type: 'REMOVE_GROUP'; sessionId: string }
  | { type: 'SET_ORGANIZER_TOKEN'; sessionId: string; token: string }
  | { type: 'SET_DISPLAY_NAME'; name: string | null }
  | { type: 'SET_USER_COLOR'; color: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'IMPORT_CALENDAR':
      return {
        ...state,
        sources: [...state.sources, action.source],
        blocks: [...state.blocks, ...action.blocks],
      };
    case 'SET_BLOCKS':
      return { ...state, blocks: action.blocks };
    case 'SET_SOURCES':
      return { ...state, sources: action.sources };
    case 'ADD_BLOCKS':
      return { ...state, blocks: [...state.blocks, ...action.blocks] };
    case 'CLEAR_BLOCKS':
      return { ...state, blocks: [], sources: [] };
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.preferences };
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId, organizerToken: action.organizerToken };
    case 'CLEAR_SESSION':
      return { ...state, sessionId: null, organizerToken: null };
    case 'ADD_GROUP':
      return {
        ...state,
        groups: state.groups.some(g => g.sessionId === action.group.sessionId)
          ? state.groups // already exists — no-op (preserve user's rename)
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
    case 'SET_DISPLAY_NAME':
      return { ...state, displayName: action.name };
    case 'SET_USER_COLOR':
      return { ...state, userColor: action.color };
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  blocks: [],
  sources: [],
  preferences: DEFAULT_PREFS,
  sessionId: null,
  organizerToken: null,
  displayName: null,
  userColor: null,
  groups: [],
  organizerTokens: {},
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
} | null>(null);

let personalSessionPromise: Promise<{ sessionId: string; organizerToken: string } | null> | null = null;

async function ensurePersonalSession(
  state: AppState,
  dispatch: React.Dispatch<Action>,
): Promise<{ sessionId: string; organizerToken: string } | null> {
  if (state.sessionId && state.organizerToken) {
    return { sessionId: state.sessionId, organizerToken: state.organizerToken };
  }
  // Deduplicate concurrent creation attempts
  if (personalSessionPromise) return personalSessionPromise;
  personalSessionPromise = (async () => {
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
    } finally {
      personalSessionPromise = null;
    }
  })();
  return personalSessionPromise;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem('calshare:preferences');
      if (savedPrefs) {
        dispatch({ type: 'SET_PREFERENCES', preferences: JSON.parse(savedPrefs) });
      }
      const savedBlocks = localStorage.getItem('calshare:blocks');
      if (savedBlocks) {
        dispatch({ type: 'SET_BLOCKS', blocks: JSON.parse(savedBlocks) });
      }
      const savedSources = localStorage.getItem('calshare:sources');
      if (savedSources) {
        dispatch({ type: 'SET_SOURCES', sources: JSON.parse(savedSources) });
      }
      const savedSessionId = localStorage.getItem('calshare:sessionId');
      const savedOrganizerToken = localStorage.getItem('calshare:organizerToken');
      if (savedSessionId && savedOrganizerToken) {
        dispatch({ type: 'SET_SESSION', sessionId: savedSessionId, organizerToken: savedOrganizerToken });
      }
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
      const savedDisplayName = localStorage.getItem('calshare:displayName');
      if (savedDisplayName) dispatch({ type: 'SET_DISPLAY_NAME', name: savedDisplayName });
      const savedUserColor = localStorage.getItem('calshare:userColor');
      if (savedUserColor) dispatch({ type: 'SET_USER_COLOR', color: savedUserColor });
    } catch {
      // localStorage unavailable or invalid JSON — use defaults
    }
    setHydrated(true);
  }, []);

  // Persist state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('calshare:preferences', JSON.stringify(state.preferences));
    } catch { /* ignore */ }
  }, [state.preferences]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:blocks', JSON.stringify(state.blocks));
    } catch { /* ignore */ }
  }, [state.blocks]);

  // Ref to always read latest state (avoids stale closures in debounced sync)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync blocks to backend on every change
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncBlocksToBackend(stateRef.current.blocks, stateRef.current, dispatch);
    }, 500);
    return () => clearTimeout(syncTimeoutRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocks, hydrated]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:sources', JSON.stringify(state.sources));
    } catch { /* ignore */ }
  }, [state.sources]);

  useEffect(() => {
    try {
      if (state.sessionId && state.organizerToken) {
        localStorage.setItem('calshare:sessionId', state.sessionId);
        localStorage.setItem('calshare:organizerToken', state.organizerToken);
      } else {
        localStorage.removeItem('calshare:sessionId');
        localStorage.removeItem('calshare:organizerToken');
      }
    } catch { /* ignore */ }
  }, [state.sessionId, state.organizerToken]);

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

  useEffect(() => {
    try {
      if (state.displayName) localStorage.setItem('calshare:displayName', state.displayName);
      else localStorage.removeItem('calshare:displayName');
    } catch { /* ignore */ }
  }, [state.displayName]);

  useEffect(() => {
    try {
      if (state.userColor) localStorage.setItem('calshare:userColor', state.userColor);
      else localStorage.removeItem('calshare:userColor');
    } catch { /* ignore */ }
  }, [state.userColor]);

  return (
    <AppContext.Provider value={{ state, dispatch, hydrated }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): { state: AppState; dispatch: React.Dispatch<Action>; hydrated: boolean } {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { DEFAULT_PREFS };
