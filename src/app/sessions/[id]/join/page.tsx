'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { state } = useApp();
  const [sessionId, setSessionId] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ lookAheadDays: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      setSessionId(p.id);
      try {
        const res = await fetch(`/api/sessions/${p.id}/join`);
        if (res.ok) setSessionInfo(await res.json());
      } catch {
        setError('Session not found or expired.');
      }
    });
  }, [params]);

  async function submitBlocks() {
    if (!sessionId || state.blocks.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: sessionId,
          blocks: state.blocks,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-bold mb-3">Availability submitted!</h1>
        <p className="text-gray-600 text-sm">
          Your anonymised availability has been added. The organiser can now see common free slots.
          No event details were shared.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Join scheduling session</h1>
      {sessionInfo && (
        <p className="text-sm text-gray-500 mb-6">
          Looking ahead {sessionInfo.lookAheadDays} days
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {state.blocks.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-2">Connect your calendar first</p>
          <p className="text-sm text-amber-700 mb-3">
            You need to add your availability before you can join this session.
          </p>
          <Link
            href={`/availability/connect?returnTo=/sessions/${sessionId}/join`}
            className="text-sm text-blue-600 underline font-medium"
          >
            Connect calendar →
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-green-800">Ready to submit</p>
          <p className="text-sm text-green-700">
            {state.blocks.filter((b) => b.busy).length} anonymised busy blocks from your calendar.
            No event details included.
          </p>
        </div>
      )}

      <button
        onClick={submitBlocks}
        disabled={submitting || state.blocks.length === 0}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit my availability'}
      </button>
    </main>
  );
}
