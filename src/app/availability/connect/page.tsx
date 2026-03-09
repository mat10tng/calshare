'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { AnonymisationPreview } from '@/components/AnonymisationPreview';
import { parseIcsFile } from '@/lib/ics-parser';
import type { BusyBlock } from '@/types';

interface PendingImport {
  blocks: BusyBlock[];
  source: string;
}

export default function ConnectPage() {
  const { dispatch } = useApp();
  const router = useRouter();
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleIcsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    setLoading(true);
    setError(null);
    try {
      const content = await file.text();
      const blocks = parseIcsFile(content);
      setPending({ blocks, source: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse .ics file.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!pending) return;
    dispatch({ type: 'ADD_BLOCKS', blocks: pending.blocks });
    setPending(null);
    router.push('/availability');
  }

  function handleCancel() {
    setPending(null);
  }

  return (
    <main className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Connect your calendar</h1>
      <p className="text-sm text-gray-500 mb-8">
        Your calendar data is processed entirely in your browser. Event details are never stored or transmitted.
      </p>

      {/* Path A: OAuth (placeholder — implemented in Task 7) */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Connect via account</h2>
        <div className="flex flex-col gap-2">
          <button
            disabled
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm text-gray-400 cursor-not-allowed bg-gray-50"
          >
            <span className="text-lg">📅</span>
            <span>Connect Google Calendar <span className="text-xs">(coming soon)</span></span>
          </button>
          <button
            disabled
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm text-gray-400 cursor-not-allowed bg-gray-50"
          >
            <span className="text-lg">📧</span>
            <span>Connect Outlook / Microsoft 365 <span className="text-xs">(coming soon)</span></span>
          </button>
        </div>
      </section>

      {/* Path B: .ics upload */}
      <section className="mb-6">
        <h2 className="text-base font-semibold mb-3">Upload a calendar file</h2>
        <p className="text-sm text-gray-500 mb-3">
          Export your calendar as a <code className="bg-gray-100 px-1 rounded">.ics</code> file and upload it here.
          Nothing is sent to any server.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Processing…' : 'Click to choose .ics file'}
          </span>
          <input
            type="file"
            accept=".ics"
            className="sr-only"
            onChange={handleIcsUpload}
            disabled={loading}
          />
        </label>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </section>

      {/* Path C: Guided export (placeholder — implemented in Task 8) */}
      <p className="text-sm text-gray-500 text-center">
        Not sure how to export?{' '}
        <button className="text-blue-600 underline hover:text-blue-700">
          See step-by-step guide
        </button>
      </p>

      {pending && (
        <AnonymisationPreview
          blocks={pending.blocks}
          source={pending.source}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </main>
  );
}
