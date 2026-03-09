'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { Nav } from '@/components/Nav';

export default function NewSessionPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
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
    <>
      <Nav />
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
          How many people need to be free?
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
          Only show times where at least {quorum} {quorum !== 1 ? 'people are' : 'person is'} available.
        </p>
      </div>

      {state.blocks.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          No calendar connected — you&apos;ll be counted as fully available.{' '}
          <Link href="/availability/connect" className="underline font-medium">
            Connect one →
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating session…' : 'Create session & get invite link'}
      </button>
    </main>
    </>
  );
}
