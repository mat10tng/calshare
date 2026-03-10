'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import { GroupsList } from '@/components/GroupsList';
import { participantColor } from '@/lib/participant-names';

export default function AvailabilityPage() {
  const { state, dispatch, hydrated } = useApp();

  // Keep URL in sync with user identity for visibility
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (state.sessionId) {
      if (url.searchParams.get('me') !== state.sessionId) {
        url.searchParams.set('me', state.sessionId);
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      if (url.searchParams.has('me')) {
        url.searchParams.delete('me');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [state.sessionId, hydrated]);
  const [activePanel, setActivePanel] = useState<null | 'create'>(null);
  const [createName, setCreateName] = useState('');
  const [createQuorum, setCreateQuorum] = useState(2);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Personal session creation + block sync handled by AppContext

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
      // Ensure personal session exists
      let personalId = state.sessionId;
      let personalToken = state.organizerToken;
      if (!personalId || !personalToken) {
        const pRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
        });
        if (!pRes.ok) throw new Error('Failed to create personal session');
        const p = await pRes.json();
        personalId = p.sessionId as string;
        personalToken = p.organizerToken as string;
        dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
      }

      // Sync blocks to personal session
      await fetch(`/api/sessions/${personalId}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${personalToken}` },
        body: JSON.stringify({ blocks: state.blocks }),
      });

      // Create group session
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quorum: createQuorum,
          lookAheadDays: state.preferences.lookAheadDays,
          name: createName.trim() || undefined,
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

      // Join group with personal session reference
      const joinRes = await fetch(`/api/sessions/${newSessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: newSessionId, personalSessionId: personalId }),
      });
      const joinData = await joinRes.json().catch(() => ({}));
      if (joinData.participantId) {
        dispatch({
          type: 'UPDATE_GROUP',
          sessionId: newSessionId,
          changes: { participantId: joinData.participantId },
        });
      }

      setCreateName('');
      setCreateQuorum(2);
      setActivePanel(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page-container">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1 className="page-title">My Page</h1>
          <div className="flex gap-2">
            <Link href="/availability/connect" className="btn btn-secondary btn-sm">
              + Connect calendar
            </Link>
            <Link href="/availability/settings" className="btn btn-ghost btn-sm">
              Settings
            </Link>
            {state.blocks.length > 0 && (
              <button
                onClick={() => dispatch({ type: 'CLEAR_BLOCKS' })}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--subtle)' }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <AvailabilityGrid
          blocks={state.blocks}
          fromDate={now}
          toDate={until}
          onBlocksChange={(newBlocks) => dispatch({ type: 'SET_BLOCKS', blocks: newBlocks })}
          busyColor={state.sessionId ? (state.userColor || participantColor(state.sessionId)) : undefined}
        />

        {activePanel === 'create' && (
          <div className="card--surface rounded-xl p-4 mb-4 mt-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="mb-4">
              <label className="label">
                Group name <span className="label-hint">(optional)</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Team standup sync"
                className="input"
                maxLength={80}
                autoFocus
              />
            </div>
            {createError && <p className="msg-error">{createError}</p>}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={createLoading} className="btn btn-primary">
                {createLoading ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => setActivePanel(null)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        <GroupsList
          groups={state.groups}
          onRename={handleRename}
          onLeave={handleLeave}
          onCreateClick={() => { setActivePanel(activePanel === 'create' ? null : 'create'); setCreateError(null); }}
        />
      </main>
    </>
  );
}
