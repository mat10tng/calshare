'use client';
import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react';
import type { BusyBlock, UserPreferences, GroupEntry } from '@/types';

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
  groups: GroupEntry[];
  organizerTokens: Record<string, string>;
}

type Action =
  | { type: 'SET_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'ADD_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'CLEAR_BLOCKS' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'ADD_GROUP'; group: GroupEntry }
  | { type: 'UPDATE_GROUP'; sessionId: string; changes: Partial<GroupEntry> }
  | { type: 'REMOVE_GROUP'; sessionId: string }
  | { type: 'SET_ORGANIZER_TOKEN'; sessionId: string; token: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BLOCKS':
      return { ...state, blocks: action.blocks };
    case 'ADD_BLOCKS':
      return { ...state, blocks: [...state.blocks, ...action.blocks] };
    case 'CLEAR_BLOCKS':
      return { ...state, blocks: [] };
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
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  blocks: [],
  preferences: DEFAULT_PREFS,
  sessionId: null,
  organizerToken: null,
  groups: [],
  organizerTokens: {},
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
} | null>(null);

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
    } catch {
      // localStorage unavailable or invalid JSON — use defaults
    }
    setHydrated(true);
  }, []);

  // Persist state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('calshare:preferences', JSON.stringify(state.preferences));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [state.preferences]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:blocks', JSON.stringify(state.blocks));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [state.blocks]);

  useEffect(() => {
    try {
      if (state.sessionId && state.organizerToken) {
        localStorage.setItem('calshare:sessionId', state.sessionId);
        localStorage.setItem('calshare:organizerToken', state.organizerToken);
      } else {
        localStorage.removeItem('calshare:sessionId');
        localStorage.removeItem('calshare:organizerToken');
      }
    } catch {
      // localStorage unavailable — silently ignore
    }
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
