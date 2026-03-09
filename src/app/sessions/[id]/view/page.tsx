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
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-gray-400 text-sm">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + data.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  const busyCount = data.blocks.filter((b) => b.busy).length;

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">Availability</h1>
      <p className="text-sm text-gray-500 mb-8">
        Next {data.lookAheadDays} days · {busyCount} busy times (event details hidden)
      </p>

      <AvailabilityGrid
        blocks={data.blocks}
        fromDate={now}
        toDate={until}
      />

      <div className="mt-10 pt-8 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-600 mb-3">Want to find a time together?</p>
        <Link
          href="/sessions/new"
          className="inline-block bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Create a group session →
        </Link>
      </div>
    </main>
  );
}
