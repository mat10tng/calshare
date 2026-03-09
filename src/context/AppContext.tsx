'use client';
import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react';
import type { BusyBlock, CalendarSource, UserPreferences } from '@/types';

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
}

type Action =
  | { type: 'IMPORT_CALENDAR'; source: CalendarSource; blocks: BusyBlock[] }
  | { type: 'SET_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'SET_SOURCES'; sources: CalendarSource[] }
  | { type: 'ADD_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'CLEAR_BLOCKS' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' };

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
      const savedSources = localStorage.getItem('calshare:sources');
      if (savedSources) {
        dispatch({ type: 'SET_SOURCES', sources: JSON.parse(savedSources) });
      }
      const savedSessionId = localStorage.getItem('calshare:sessionId');
      const savedOrganizerToken = localStorage.getItem('calshare:organizerToken');
      if (savedSessionId && savedOrganizerToken) {
        dispatch({ type: 'SET_SESSION', sessionId: savedSessionId, organizerToken: savedOrganizerToken });
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
    } catch { /* ignore */ }
  }, [state.preferences]);

  useEffect(() => {
    try {
      localStorage.setItem('calshare:blocks', JSON.stringify(state.blocks));
    } catch { /* ignore */ }
  }, [state.blocks]);

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
