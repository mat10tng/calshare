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
  | { type: 'ADD_BLOCKS'; blocks: BusyBlock[] }
  | { type: 'CLEAR_BLOCKS' }
  | { type: 'SET_PREFERENCES'; preferences: UserPreferences }
  | { type: 'SET_SESSION'; sessionId: string; organizerToken: string }
  | { type: 'CLEAR_SESSION' };

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
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  blocks: [],
  preferences: DEFAULT_PREFS,
  sessionId: null,
  organizerToken: null,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Load persisted preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calshare:preferences');
      if (saved) {
        dispatch({ type: 'SET_PREFERENCES', preferences: JSON.parse(saved) });
      }
    } catch {
      // localStorage unavailable or invalid JSON — use defaults
    }
  }, []);

  // Persist preferences whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('calshare:preferences', JSON.stringify(state.preferences));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [state.preferences]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { DEFAULT_PREFS };
