'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Nav } from '@/components/Nav';

export default function Home() {
  const { state, hydrated } = useApp();
  const hasGroups = state.groups.length > 0;

  if (!hydrated) {
    return (
      <>
        <Nav />
        <main className="page-container page-container--narrow" />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="page-container page-container--narrow" style={{ paddingTop: '6rem' }}>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--foreground)' }}>
          CalShare
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--subtle)' }}>
          Share your availability. Find a time that works.
        </p>

        <div className="flex flex-col gap-3 mb-10" style={{ maxWidth: '16rem' }}>
          <Link href={state.sessionId ? `/me?id=${state.sessionId}` : '/me'} className="btn btn-primary" style={{ justifyContent: 'center' }}>
            My Calendar
          </Link>

          {hasGroups && (
            <div className="flex flex-col gap-1.5 mt-4">
              <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>Your groups</p>
              {state.groups.map((g) => (
                <Link
                  key={g.sessionId}
                  href={`/group?id=${g.sessionId}`}
                  className="text-sm px-3 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <section style={{ color: 'var(--muted)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>How it works</h2>
          <ol className="text-sm flex flex-col gap-2" style={{ lineHeight: 1.6 }}>
            <li><strong style={{ color: 'var(--foreground)' }}>1. Mark your busy hours</strong> — drag on the calendar grid to toggle time slots as busy or free.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>2. Create or join a group</strong> — share the link so others can add their availability.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>3. See everyone at a glance</strong> — colored cells show who is busy when. Hover a name to highlight their slots.</li>
            <li><strong style={{ color: 'var(--foreground)' }}>4. Suggest a meetup</strong> — propose a time, then everyone picks the hours that work for them.</li>
          </ol>
        </section>
      </main>
    </>
  );
}
