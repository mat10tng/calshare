'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import { GroupsList } from '@/components/GroupsList';
import { parseSessionId } from '@/lib/parse-session-id';

export default function AvailabilityPage() {
  const { state, dispatch, hydrated } = useApp();
  const sessionCreating = useRef(false);
  const [activePanel, setActivePanel] = useState<null | 'create' | 'join'>(null);
  const [createName, setCreateName] = useState('');
  const [createQuorum, setCreateQuorum] = useState(2);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auto-create a session for this organizer once hydration confirms no existing session
  useEffect(() => {
    if (!hydrated) return;
    if (state.sessionId) return;
    if (sessionCreating.current) return;
    sessionCreating.current = true;
    (async () => {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, expiryDays: 30 }),
        });
        if (res.ok) {
          const { sessionId, organizerToken } = await res.json();
          dispatch({ type: 'SET_SESSION', sessionId, organizerToken });
        }
      } catch {
        // Non-fatal — session can be created later
      }
    })();
  }, [hydrated, state.sessionId, dispatch]);

  // Sync blocks to the organizer's session slot (debounced 1 s)
  useEffect(() => {
    if (!state.sessionId || !state.organizerToken) return;
    const sessionId = state.sessionId;
    const organizerToken = state.organizerToken;
    const timer = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}`,
        },
        body: JSON.stringify({ blocks: state.blocks }),
      }).catch(() => {/* non-fatal */});
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.blocks, state.sessionId, state.organizerToken]);

  // Sync blocks to all joined groups (debounced 1 s)
  useEffect(() => {
    if (state.groups.length === 0) return;
    const timer = setTimeout(() => {
      for (const group of state.groups) {
        if (group.role === 'organizer') {
          const token = state.organizerTokens[group.sessionId];
          if (!token) continue;
          fetch(`/api/sessions/${group.sessionId}/participants`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ blocks: state.blocks }),
          }).catch(() => {/* non-fatal */});
        } else if (group.role === 'participant' && group.participantId) {
          fetch(`/api/sessions/${group.sessionId}/participants/${group.participantId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participantToken: group.participantId,
              blocks: state.blocks,
            }),
          }).catch(() => {/* non-fatal */});
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.blocks, state.groups, state.organizerTokens]);

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(
    Date.now() + state.preferences.lookAheadDays * 86_400_000,
  )
    .toISOString()
    .split('T')[0];

  function handleRename(sessionId: string, name: string) {
    dispatch({ type: 'UPDATE_GROUP', sessionId, changes: { name } });
  }

  function handleLeave(sessionId: string) {
    dispatch({ type: 'REMOVE_GROUP', sessionId });
  }

  async function handleCreate() {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quorum: createQuorum,
          lookAheadDays: state.preferences.lookAheadDays,
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const { sessionId: newSessionId, organizerToken } = await res.json();

      const resolvedName = createName.trim() || `Group ${newSessionId}`;
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId: newSessionId,
          role: 'organizer',
          name: resolvedName,
          joinedAt: new Date().toISOString(),
        },
      });
      dispatch({ type: 'SET_ORGANIZER_TOKEN', sessionId: newSessionId, token: organizerToken });

      await fetch(`/api/sessions/${newSessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: newSessionId, blocks: state.blocks }),
      });

      setCreateName('');
      setCreateQuorum(2);
      setActivePanel(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin() {
    const sessionId = parseSessionId(joinInput);
    if (!sessionId) {
      setJoinError('Please enter a valid join link or session ID.');
      return;
    }
    setJoinLoading(true);
    setJoinError(null);
    try {
      const validateRes = await fetch(`/api/sessions/${sessionId}/join`);
      if (!validateRes.ok) throw new Error('Session not found or expired.');

      const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: sessionId, blocks: state.blocks }),
      });
      const joinData = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) {
        throw new Error((joinData as { error?: string }).error ?? 'Failed to join group.');
      }

      const { participantId } = joinData as { participantId: string };
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId,
          role: 'participant',
          participantId,
          name: `Group ${sessionId}`,
          joinedAt: new Date().toISOString(),
        },
      });

      setJoinInput('');
      setActivePanel(null);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join group.');
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto py-12 px-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Your Availability</h1>
        <div className="flex gap-2">
          <Link
            href="/availability/connect"
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            + Connect calendar
          </Link>
          <Link
            href="/availability/preferences"
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Preferences
          </Link>
          {state.blocks.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'CLEAR_BLOCKS' })}
              className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {state.blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-lg font-medium text-gray-600 mb-2">No busy times — you&apos;re fully open</p>
          <p className="text-sm mb-6">
            Connect a calendar to import busy blocks, or schedule with a group as-is.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/availability/connect"
              className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Connect a calendar
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Showing {state.blocks.filter((b) => b.busy).length} busy times across the next{' '}
            {state.preferences.lookAheadDays} days
          </p>
          <AvailabilityGrid
            blocks={state.blocks}
            fromDate={now}
            toDate={until}
            onBlocksChange={(newBlocks) => dispatch({ type: 'SET_BLOCKS', blocks: newBlocks })}
          />
          {state.sessionId && (
            <div className="mt-4">
              <Link
                href={`/sessions/${state.sessionId}/view`}
                className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Share my availability →
              </Link>
            </div>
          )}
        </>
      )}

      {/* Inline create / join panel */}
      <div className="mt-8">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setActivePanel(activePanel === 'create' ? null : 'create'); setCreateError(null); }}
            className={`text-sm border rounded-lg px-3 py-1.5 transition-colors ${activePanel === 'create' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            + Create a new group
          </button>
          <button
            onClick={() => { setActivePanel(activePanel === 'join' ? null : 'join'); setJoinError(null); }}
            className={`text-sm border rounded-lg px-3 py-1.5 transition-colors ${activePanel === 'join' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            Join a group
          </button>
        </div>

        {activePanel === 'create' && (
          <div className="border rounded-xl p-4 mb-4 bg-gray-50">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Group name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Team standup sync"
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                maxLength={80}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                How many people need to be free?
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={createQuorum}
                onChange={(e) => setCreateQuorum(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="border rounded-lg px-3 py-2 w-24 text-sm bg-white"
              />
            </div>
            {createError && <p className="text-sm text-red-600 mb-3">{createError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createLoading ? 'Creating…' : 'Create session'}
              </button>
              <button
                onClick={() => setActivePanel(null)}
                className="border rounded-lg px-4 py-2 text-sm hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activePanel === 'join' && (
          <div className="border rounded-xl p-4 mb-4 bg-gray-50">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Paste join link or session ID
              </label>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="https://…/sessions/ABC123/join  or  ABC123"
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
              />
            </div>
            {joinError && <p className="text-sm text-red-600 mb-3">{joinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleJoin}
                disabled={joinLoading || !joinInput.trim()}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {joinLoading ? 'Joining…' : 'Join group'}
              </button>
              <button
                onClick={() => setActivePanel(null)}
                className="border rounded-lg px-4 py-2 text-sm hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <GroupsList
        groups={state.groups}
        onRename={handleRename}
        onLeave={handleLeave}
      />
    </main>
    </>
  );
}
