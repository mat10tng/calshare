'use client';
import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Nav } from '@/components/Nav';
import { useRouter } from 'next/navigation';

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { state, dispatch, hydrated } = useApp();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading…');
  const joiningRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    params.then((p) => autoJoin(p.id));
  }, [hydrated, params]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoJoin(groupSessionId: string) {
    if (joiningRef.current) return;
    joiningRef.current = true;

    try {
      // Check if already a member
      const existing = state.groups.find(g => g.sessionId === groupSessionId);
      if (existing) {
        router.replace(`/group?id=${groupSessionId}`);
        return;
      }

      setStatus('Joining group…');

      // Fetch session info for the name
      const infoRes = await fetch(`/api/sessions/${groupSessionId}/join`);
      if (!infoRes.ok) { setError('Session not found or expired.'); return; }
      const info = await infoRes.json() as { name?: string | null };

      // Ensure personal session exists
      let personalId = state.sessionId;
      let personalToken = state.organizerToken;

      if (!personalId || !personalToken) {
        const createRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
        });
        if (!createRes.ok) throw new Error('Failed to create personal session');
        const created = await createRes.json();
        personalId = created.sessionId as string;
        personalToken = created.organizerToken as string;
        dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
      }

      // Join the group
      const joinRes = await fetch(`/api/sessions/${groupSessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: groupSessionId, personalSessionId: personalId }),
      });
      if (!joinRes.ok) {
        const d = await joinRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Failed to join group session');
      }

      const { participantId } = await joinRes.json() as { participantId: string };

      const resolvedName = info.name || `Group ${groupSessionId}`;
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId: groupSessionId,
          role: 'participant',
          participantId,
          name: resolvedName,
          joinedAt: new Date().toISOString(),
        },
      });

      router.replace(`/group?id=${groupSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join.');
    }
  }

  return (
    <>
      <Nav />
      <main className="page-container page-container--narrow text-center" style={{ paddingTop: '4rem' }}>
        {error ? (
          <>
            <p className="text-sm" style={{ color: 'var(--error, #c00)' }}>{error}</p>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{status}</p>
        )}
      </main>
    </>
  );
}
