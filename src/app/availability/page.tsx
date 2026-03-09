'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import { GroupsList } from '@/components/GroupsList';

export default function AvailabilityPage() {
  const { state, dispatch, hydrated } = useApp();
  const sessionCreating = useRef(false);

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
            <Link
              href="/sessions/new"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Schedule with open availability →
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
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sessions/new"
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Plan with a group
            </Link>
            {state.sessionId && (
              <Link
                href={`/sessions/${state.sessionId}/view`}
                className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Share my availability →
              </Link>
            )}
          </div>
        </>
      )}
      <GroupsList
        groups={state.groups}
        onRename={handleRename}
        onLeave={handleLeave}
      />
    </main>
    </>
  );
}
