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
        setSessionId(data.sessionId);
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
  const until = new Date(Date.now() + lookAheadDays * 86_400_000).toISOString().split('T')[0];

  return (
    <>
      <Nav />
      <main className="page-container">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Loading…</p>
        ) : notFound ? (
          <p style={{ color: 'var(--muted)' }}>This availability link has expired or doesn&apos;t exist.</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h1 className="page-title">Shared availability</h1>
              {sessionId && (
                <Link href={`/sessions/${sessionId}/join`} className="btn btn-primary">
                  Join their group session &rarr;
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
