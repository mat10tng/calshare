'use client';
import { useEffect, useState } from 'react';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import type { BusyBlock } from '@/types';

interface PublicData {
  sessionId: string;
  lookAheadDays: number;
  blocks: BusyBlock[];
}

export default function PublicAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const res = await fetch(`/api/sessions/${p.id}/public`);
        if (!res.ok) throw new Error('Not found');
        setData(await res.json());
      } catch {
        setError('This availability link has expired or does not exist.');
      }
    });
  }, [params]);

  if (error) {
    return (
      <main className="page-container page-container--narrow text-center" style={{ paddingTop: '4rem' }}>
        <p className="text-sm" style={{ color: 'var(--subtle)' }}>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-container page-container--narrow text-center" style={{ paddingTop: '4rem' }}>
        <p className="text-sm" style={{ color: 'var(--subtle)' }}>Loading…</p>
      </main>
    );
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + data.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  const busyCount = data.blocks.filter((b) => b.busy).length;

  return (
    <main className="page-container">
      <h1 className="page-title mb-1">Availability</h1>
      <p className="page-subtitle mb-8">
        Next {data.lookAheadDays} days · {busyCount} busy times (event details hidden)
      </p>

      <AvailabilityGrid
        blocks={data.blocks}
        fromDate={now}
        toDate={until}
      />

      <div className="mt-10 pt-8 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Want to find a time together?</p>
        <Link href="/me" className="btn btn-primary">
          Create a group session &rarr;
        </Link>
      </div>
    </main>
  );
}
