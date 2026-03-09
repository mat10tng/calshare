'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';

export default function AvailabilityPage() {
  const { state, dispatch } = useApp();

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(
    Date.now() + state.preferences.lookAheadDays * 86_400_000,
  )
    .toISOString()
    .split('T')[0];

  return (
    <main className="max-w-5xl mx-auto py-12 px-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Your Availability</h1>
        <div className="flex gap-2">
          <Link
            href="/availability/connect"
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            + Connect calendar
          </Link>
          <Link
            href="/availability/preferences"
            className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Preferences
          </Link>
          {state.blocks.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'CLEAR_BLOCKS' })}
              className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {state.blocks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-lg font-medium text-gray-600 mb-2">No calendars connected yet</p>
          <p className="text-sm mb-6">Connect a calendar to see your free/busy availability.</p>
          <Link
            href="/availability/connect"
            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Connect your first calendar
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Showing {state.blocks.filter((b) => b.busy).length} busy blocks across{' '}
            {state.preferences.lookAheadDays} days
          </p>
          <AvailabilityGrid blocks={state.blocks} fromDate={now} toDate={until} />
          <div className="mt-6 flex gap-3">
            <Link
              href="/sessions/new"
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Schedule with a group
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
