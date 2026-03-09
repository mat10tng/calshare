'use client';
import { useEffect, useState } from 'react';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

export default function PublicAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [blocks, setBlocks] = useState<BusyBlock[]>([]);
  const [lookAheadDays, setLookAheadDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const res = await fetch(`/api/sessions/${p.id}/public`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setSessionId(data.sessionId);   // set from API response, not from URL param
        setBlocks(data.blocks);
        setLookAheadDays(data.lookAheadDays);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const now = new Date().toISOString().split('T')[0];
  // lookAheadDays is only used in the success branch; default 14 is fine as placeholder
  const until = new Date(Date.now() + lookAheadDays * 86_400_000).toISOString().split('T')[0];

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto py-12 px-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : notFound ? (
          <p className="text-gray-500">This availability link has expired or doesn&apos;t exist.</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold">Shared availability</h1>
              {sessionId && (
                <Link
                  href={`/sessions/${sessionId}/join`}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Join their group session →
                </Link>
              )}
            </div>
            <AvailabilityGrid blocks={blocks} fromDate={now} toDate={until} />
          </>
        )}
      </main>
    </>
  );
}
