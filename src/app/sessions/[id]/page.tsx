'use client';
import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { mergeGroupAvailability } from '@/lib/merge';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import type { BusyBlock } from '@/types';

interface Participant {
  id: string;
  blocks: BusyBlock[];
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { state } = useApp();
  const [sessionId, setSessionId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [quorum, setQuorum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params.then((p) => setSessionId(p.id));
  }, [params]);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !state.organizerToken) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${state.organizerToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setParticipants(data.participants);
    setQuorum(data.quorum);
    setLoading(false);
  }, [sessionId, state.organizerToken]);

  useEffect(() => {
    if (!sessionId) return;
    fetchSession();
    const interval = setInterval(fetchSession, 10_000);
    return () => clearInterval(interval);
  }, [sessionId, fetchSession]);

  const joinLink = typeof window !== 'undefined' && sessionId
    ? `${window.location.origin}/sessions/${sessionId}/join`
    : '';

  async function copyLink() {
    await navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + state.preferences.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  const allBusy = participants.flatMap((p) => p.blocks);
  const freeSlots = participants.length >= quorum
    ? mergeGroupAvailability(
        participants.map((p) => p.blocks),
        state.preferences,
        now,
        until,
        quorum,
      )
    : [];

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto py-12 px-4">
      <Link href="/availability" className="text-sm text-stone-600 hover:underline mb-6 flex items-center gap-1">
        ← Back
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Group Session</h1>
          <p className="text-sm text-stone-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''} contributed
            {quorum > 1 ? ` · showing slots where ≥${quorum} are free` : ''}
          </p>
        </div>
      </div>

      {/* Invite link */}
      <div className="bg-stone-50 rounded-xl p-4 mb-8">
        <p className="text-sm font-semibold mb-3">Invite link — share this with your group</p>
        <div className="flex gap-2 items-stretch">
          <code className="flex-1 text-xs bg-white border rounded-lg px-3 py-2.5 break-all self-center">
            {joinLink || '…'}
          </code>
          <button
            onClick={copyLink}
            className="text-sm border rounded-lg px-4 py-2.5 hover:bg-stone-50 transition-colors whitespace-nowrap font-medium min-h-[44px]"
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Loading participant availability…</p>
      ) : participants.length === 0 ? (
        <p className="text-stone-400 text-sm">Waiting for participants to join and submit their availability.</p>
      ) : (
        <>
          <h2 className="text-base font-semibold mb-3">
            Times that work for everyone
            {freeSlots.length === 0 && ' — none found yet'}
          </h2>
          <AvailabilityGrid
            blocks={[...allBusy, ...freeSlots]}
            fromDate={now}
            toDate={until}
          />
        </>
      )}
    </main>
    </>
  );
}
