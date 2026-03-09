'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';

export default function NewSessionPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [quorum, setQuorum] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBlocks = state.blocks.length > 0;

  async function handleCreate() {
    if (!hasBlocks) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quorum,
          lookAheadDays: state.preferences.lookAheadDays,
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const { sessionId, organizerToken } = await res.json();

      dispatch({ type: 'SET_SESSION', sessionId, organizerToken });

      // Submit own blocks immediately
      await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: sessionId,
          blocks: state.blocks,
        }),
      });

      router.push(`/sessions/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto py-12 px-4">
      <Link href="/availability" className="text-sm text-blue-600 hover:underline mb-6 flex items-center gap-1">
        ← Back to availability
      </Link>

      <h1 className="text-2xl font-bold mb-2">New Group Session</h1>
      <p className="text-sm text-gray-500 mb-8">
        Create a scheduling session and share an invite link. Participants submit their anonymised availability — you see when everyone is free.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Minimum free participants (quorum)
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={quorum}
          onChange={(e) => setQuorum(Math.max(1, Math.min(20, Number(e.target.value))))}
          className="border rounded-lg px-3 py-2 w-full text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Only show slots where at least {quorum} participant{quorum !== 1 ? 's are' : ' is'} free.
        </p>
      </div>

      {!hasBlocks && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          You need to{' '}
          <Link href="/availability/connect" className="underline font-medium">
            connect a calendar
          </Link>{' '}
          first so your availability is included.
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading || !hasBlocks}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating session…' : 'Create session & get invite link'}
      </button>
    </main>
  );
}
