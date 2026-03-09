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
    if (!sessionId) return;
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
        <h1 className="text-2xl font-bold mb-3">Availability shared!</h1>
        <p className="text-gray-600 text-sm">
          Your free times have been added. The organiser can now see when everyone can meet.
          No event details were shared.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-3">You&apos;ve been invited to find a time together</h1>
      <p className="text-sm text-gray-600 mb-6">
        Add your free times and the organiser can see when everyone can meet —
        without seeing your calendar details.
      </p>

      {sessionInfo && (
        <p className="text-xs text-gray-400 mb-4">
          Looking ahead {sessionInfo.lookAheadDays} days
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {state.blocks.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-blue-800">ℹ️ No calendar connected — you&apos;ll be marked as free</p>
          <p className="text-sm text-blue-700 mt-1">
            <Link
              href={`/availability/connect?returnTo=/sessions/${sessionId}/join`}
              className="underline font-medium"
            >
              Add your calendar first →
            </Link>
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-green-800">✅ Calendar connected</p>
          <p className="text-sm text-green-700 mt-1">
            {state.blocks.filter((b) => b.busy).length} busy times found (details hidden).
          </p>
        </div>
      )}

      <button
        onClick={submitBlocks}
        disabled={submitting}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Sharing…' : 'Share my free times'}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        🔒 No account needed. No event details shared.
      </p>
    </main>
  );
}
