'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { ProfilePopover } from './ProfilePopover';

function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center transition-colors"
        style={{ color: 'var(--subtle)', border: '1px solid var(--border)' }}
        title="How it works"
      >
        ?
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-lg p-4"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px var(--card-shadow)',
            width: 280,
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>How it works</p>
          <ol className="text-xs flex flex-col gap-1.5" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
            <li><strong style={{ color: 'var(--foreground)' }}>1.</strong> Drag on the grid to mark busy / free hours.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>2.</strong> Create or join a group and share the link.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>3.</strong> See everyone&apos;s availability — hover a name to highlight.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>4.</strong> Suggest a meetup and pick times that work.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const { state } = useApp();

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 backdrop-blur-sm"
      style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)' }}
    >
      <Link
        href="/"
        className="font-semibold text-lg tracking-tight flex items-baseline gap-1.5"
        style={{ color: 'var(--foreground)' }}
      >
        CalShare
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <HelpPopover />
        <ProfilePopover />
      </div>
    </nav>
  );
}
