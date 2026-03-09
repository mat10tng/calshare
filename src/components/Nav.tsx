'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';

export function Nav() {
  const { state } = useApp();
  const sessionHref = state.sessionId ? `/sessions/${state.sessionId}` : '/sessions/new';

  return (
    <nav className="border-b px-4 py-3 flex items-center justify-between">
      <Link href="/availability" className="font-bold text-blue-600 text-lg flex items-baseline gap-1.5">
        CalShare
        <span className="text-xs font-normal text-gray-400">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/availability" className="text-gray-600 hover:text-gray-900 transition-colors">
          My Availability
        </Link>
        <Link
          href={sessionHref}
          className="bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          Group Session
          {state.sessionId && (
            <span className="w-2 h-2 rounded-full bg-green-300 inline-block" title="Active session" />
          )}
        </Link>
      </div>
    </nav>
  );
}
