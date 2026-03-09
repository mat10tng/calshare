'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { state, dispatch } = useApp();
  const [sessionId, setSessionId] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ lookAheadDays: number } | null>(null);
  const [localBlocks, setLocalBlocks] = useState<BusyBlock[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [personalSessionId, setPersonalSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      setSessionId(p.id);
      try {
        const res = await fetch(`/api/sessions/${p.id}/join`);
        if (res.ok) setSessionInfo(await res.json());
        else setError('Session not found or expired.');
      } catch {
        setError('Session not found or expired.');
      }
    });
  }, [params]);

  // Initialise local blocks from AppContext once on mount
  useEffect(() => {
    setLocalBlocks(state.blocks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once

  async function submitBlocks() {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Join the group session
      const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: sessionId, blocks: localBlocks }),
      });
      if (!joinRes.ok) {
        const d = await joinRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Failed to join group session');
      }

      // 2. Save blocks to AppContext
      dispatch({ type: 'SET_BLOCKS', blocks: localBlocks });

      // 3. Create personal session if none exists
      let personalId = state.sessionId;
      let personalToken = state.organizerToken;

      if (!personalId || !personalToken) {
        const createRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, expiryDays: 30 }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          personalId = created.sessionId as string;
          personalToken = created.organizerToken as string;
          dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
        }
      }

      // 4. Save blocks to personal session organizer slot
      if (personalId && personalToken) {
        await fetch(`/api/sessions/${personalId}/participants`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${personalToken}`,
          },
          body: JSON.stringify({ blocks: localBlocks }),
        });
        setPersonalSessionId(personalId);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(
    Date.now() + (sessionInfo?.lookAheadDays ?? 14) * 86_400_000
  ).toISOString().split('T')[0];

  if (submitted) {
    const personalUrl = personalSessionId && typeof window !== 'undefined'
      ? `${window.location.origin}/u/${personalSessionId}`
      : null;

    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-bold mb-3">Availability submitted!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Your anonymised availability has been added to the group session.
        </p>
        {personalUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-blue-800 mb-2">Your personal availability link:</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-white border rounded px-3 py-2 break-all">
                {personalUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(personalUrl)}
                className="text-sm border rounded-lg px-3 py-2 hover:bg-white transition-colors whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Share this link so others can see your availability.
            </p>
          </div>
        )}
      </main>
    );
  }

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-2">Join scheduling session</h1>
        {sessionInfo && (
          <p className="text-sm text-gray-500 mb-4">Looking ahead {sessionInfo.lookAheadDays} days</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-gray-600 font-medium">
            Mark your busy times (drag to toggle):
          </p>
          <Link
            href={`/availability/connect?returnTo=/sessions/${sessionId}/join`}
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            + Connect calendar
          </Link>
        </div>

        <AvailabilityGrid
          blocks={localBlocks}
          fromDate={now}
          toDate={until}
          onBlocksChange={setLocalBlocks}
        />

        <button
          onClick={submitBlocks}
          disabled={submitting || !sessionId}
          className="mt-6 w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit my availability'}
        </button>
      </main>
    </>
  );
}
