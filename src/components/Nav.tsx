'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { participantName, participantColor } from '@/lib/participant-names';

export function Nav() {
  const { state } = useApp();

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 backdrop-blur-sm"
      style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)' }}
    >
      <Link
        href={state.sessionId ? `/me?id=${state.sessionId}` : '/me'}
        className="font-semibold text-lg tracking-tight flex items-baseline gap-1.5"
        style={{ color: 'var(--foreground)' }}
      >
        CalShare
        <span className="text-xs font-normal" style={{ color: 'var(--subtle)' }}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {state.sessionId && (
          <Link href={`/me?id=${state.sessionId}`} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: 'var(--subtle)' }}>
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: state.userColor || participantColor(state.sessionId) }}
            />
            {state.displayName || participantName(state.sessionId)}
          </Link>
        )}
      </div>
    </nav>
  );
}
