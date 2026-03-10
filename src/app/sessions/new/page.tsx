'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { Nav } from '@/components/Nav';

export default function NewSessionPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [quorum, setQuorum] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quorum,
          lookAheadDays: state.preferences.lookAheadDays,
          name: groupName.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const { sessionId, organizerToken } = await res.json();

      const resolvedName = groupName.trim() || `Group ${sessionId}`;
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId,
          role: 'organizer',
          name: resolvedName,
          joinedAt: new Date().toISOString(),
        },
      });
      dispatch({ type: 'SET_ORGANIZER_TOKEN', sessionId, token: organizerToken });

      // Ensure personal session exists, then join group with reference
      let personalId: string = state.sessionId ?? '';
      let personalToken: string = state.organizerToken ?? '';
      if (!personalId || !personalToken) {
        const personalRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
        });
        if (!personalRes.ok) throw new Error('Failed to create personal session');
        const personal = await personalRes.json();
        personalId = personal.sessionId as string;
        personalToken = personal.organizerToken as string;
        dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
      }

      // Sync blocks to personal session
      await fetch(`/api/sessions/${personalId}/participants`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${personalToken}`,
        },
        body: JSON.stringify({ blocks: state.blocks }),
      });

      // Join group with personal session reference
      await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: sessionId,
          personalSessionId: personalId,
        }),
      });

      router.push(`/group?id=${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page-container page-container--narrow">
        <Link href="/me" className="back-link">&larr; Back to availability</Link>

        <h1 className="page-title mb-2">New Group Session</h1>
        <p className="page-subtitle mb-8">
          Create a scheduling session and share an invite link. Participants submit their anonymised availability — you see when everyone is free.
        </p>

        <div className="mb-6">
          <label className="label">
            Group name <span className="label-hint">(optional)</span>
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Team standup sync"
            className="input"
            maxLength={80}
          />
        </div>

        <div className="mb-6">
          <label className="label">How many people need to be free?</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quorum}
            onChange={(e) => setQuorum(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="input"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Only show times where at least {quorum} {quorum !== 1 ? 'people are' : 'person is'} available.
          </p>
        </div>

        {state.blocks.length === 0 && (
          <div className="msg-info mb-4">
            No calendar connected — you&apos;ll be counted as fully available.{' '}
            <Link href="/me/connect" className="underline font-medium" style={{ color: 'var(--foreground)' }}>
              Connect one &rarr;
            </Link>
          </div>
        )}

        {error && <p className="msg-error">{error}</p>}

        <button onClick={handleCreate} disabled={loading} className="btn btn-primary w-full justify-center" style={{ padding: '0.625rem 1rem' }}>
          {loading ? 'Creating session…' : 'Create session & get invite link'}
        </button>
      </main>
    </>
  );
}
