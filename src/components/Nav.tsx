'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { ProfilePopover } from './ProfilePopover';

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
        <ProfilePopover />
      </div>
    </nav>
  );
}
