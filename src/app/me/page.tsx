'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import { GroupsList } from '@/components/GroupsList';
import { participantColor } from '@/lib/participant-names';
import type { BusyBlock, RecurringEvent } from '@/types';

export default function AvailabilityPage() {
  const { state, dispatch, hydrated } = useApp();

  // Keep URL in sync with user identity for visibility
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (state.sessionId) {
      if (url.searchParams.get('id') !== state.sessionId) {
        url.searchParams.set('id', state.sessionId);
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      if (url.searchParams.has('id')) {
        url.searchParams.delete('id');
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

  // Expand recurring events into BusyBlocks for the visible date range
  const recurringBlocks = useMemo(() => {
    const blocks: BusyBlock[] = [];
    const cur = new Date(now + 'T00:00:00.000Z');
    const end = new Date(until + 'T00:00:00.000Z');
    while (cur <= end) {
      const dow = cur.getUTCDay();
      const dateStr = cur.toISOString().split('T')[0];
      for (const ev of state.recurringEvents) {
        if (ev.dayOfWeek === dow) {
          const sh = String(ev.startHour).padStart(2, '0');
          const eh = String(ev.endHour).padStart(2, '0');
          blocks.push({
            start: `${dateStr}T${sh}:00:00.000Z`,
            end: `${dateStr}T${eh}:00:00.000Z`,
            busy: true,
            allDay: false,
            title: ev.title,
            sourceId: `recurring:${ev.id}`,
          });
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return blocks;
  }, [state.recurringEvents, now, until]);

  // Merge manual blocks with recurring blocks
  const allBlocks = useMemo(() => {
    return [...state.blocks, ...recurringBlocks];
  }, [state.blocks, recurringBlocks]);

  const [showRecurring, setShowRecurring] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDay, setNewDay] = useState(1);
  const [newStartHour, setNewStartHour] = useState(18);
  const [newEndHour, setNewEndHour] = useState(19);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

  function addRecurringEvent() {
    if (!newTitle.trim() || newStartHour >= newEndHour) return;
    const ev: RecurringEvent = {
      id: crypto.randomUUID().slice(0, 8),
      title: newTitle.trim(),
      dayOfWeek: newDay,
      startHour: newStartHour,
      endHour: newEndHour,
    };
    dispatch({ type: 'SET_RECURRING_EVENTS', events: [...state.recurringEvents, ev] });
    setNewTitle('');
  }

  function removeRecurringEvent(id: string) {
    dispatch({ type: 'SET_RECURRING_EVENTS', events: state.recurringEvents.filter(e => e.id !== id) });
  }

  function toggleShareTitle(id: string) {
    dispatch({
      type: 'SET_RECURRING_EVENTS',
      events: state.recurringEvents.map(e =>
        e.id === id ? { ...e, shareTitle: !e.shareTitle } : e
      ),
    });
  }

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
        <div className="flex flex-wrap justify-end items-center gap-3 mb-6">
          <div className="flex gap-2">
            <Link href="/me/connect" className="btn btn-secondary btn-sm">
              + Connect calendar
            </Link>
            <Link href="/me/settings" className="btn btn-ghost btn-sm">
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
          blocks={allBlocks}
          fromDate={now}
          toDate={until}
          onBlocksChange={(newBlocks) => {
            // Filter out recurring-sourced blocks so we only persist manual edits
            const manual = newBlocks.filter(b => !b.sourceId?.startsWith('recurring:'));
            dispatch({ type: 'SET_BLOCKS', blocks: manual });
          }}
          busyColor={state.sessionId ? (state.userColor || participantColor(state.sessionId)) : undefined}
        />

        {/* Recurring events */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recurring</h2>
            <button
              className="inline-flex items-center justify-center w-5 h-5 rounded text-sm leading-none"
              style={{ color: 'var(--subtle)', border: '1px solid var(--border)' }}
              onClick={() => setShowRecurring(!showRecurring)}
              title="Add recurring event"
            >
              +
            </button>
          </div>

          {state.recurringEvents.length > 0 && (
            <ul className="flex flex-col gap-1.5 mb-3">
              {state.recurringEvents.map(ev => (
                <li
                  key={ev.id}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                >
                  <span className="flex-1" style={{ color: 'var(--foreground)' }}>
                    {ev.title}
                    <span className="ml-2" style={{ color: 'var(--subtle)' }}>
                      {DAY_NAMES[ev.dayOfWeek]} {String(ev.startHour).padStart(2, '0')}:00–{String(ev.endHour).padStart(2, '0')}:00
                    </span>
                  </span>
                  <button
                    onClick={() => toggleShareTitle(ev.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: ev.shareTitle ? 'var(--accent)' : 'var(--subtle)' }}
                    title={ev.shareTitle ? 'Title visible to groups' : 'Title hidden from groups'}
                  >
                    {ev.shareTitle ? 'Shared' : 'Private'}
                  </button>
                  <button
                    onClick={() => removeRecurringEvent(ev.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--subtle)' }}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showRecurring && (
            <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addRecurringEvent(); }}
                    placeholder="e.g. Muay Thai"
                    className="input"
                    style={{ width: '10rem' }}
                    maxLength={50}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Day</label>
                  <select value={newDay} onChange={e => setNewDay(Number(e.target.value))} className="input" style={{ width: 'auto' }}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">From</label>
                  <select value={newStartHour} onChange={e => setNewStartHour(Number(e.target.value))} className="input" style={{ width: 'auto' }}>
                    {ALL_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">To</label>
                  <select
                    value={newEndHour}
                    onChange={e => setNewEndHour(Number(e.target.value))}
                    className="input"
                    style={{ width: 'auto' }}
                  >
                    {ALL_HOURS.filter(h => h > newStartHour).map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addRecurringEvent}
                  disabled={!newTitle.trim() || newStartHour >= newEndHour}
                  className="btn btn-primary btn-sm"
                >
                  Add
                </button>
                <button onClick={() => setShowRecurring(false)} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </section>

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
