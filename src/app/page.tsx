'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/* ── tiny calendar grid data ─────────────────────────────── */
const HOURS = ['9a', '10', '11', '12p', '1', '2', '3', '4', '5'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// busy pattern – 1 = busy, 0 = free
const BUSY: number[][] = [
  [0, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 1, 1, 0, 0],
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* Google Font – Instrument Serif for editorial display type */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
        rel="stylesheet"
      />

      {/* grain overlay */}
      <div className="landing-grain" />

      {/* ── NAV ────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-sm"
        style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)' }}
      >
        <Link
          href="/availability"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '1.35rem', color: 'var(--foreground)' }}
          className="tracking-tight"
        >
          CalShare
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/availability"
            className="transition-colors"
            style={{ color: 'var(--subtle)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtle)')}
          >
            My Availability
          </Link>
          <Link
            href="/sessions/new"
            className="rounded-full px-4 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
            style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--btn-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--btn-bg)')}
          >
            New Group
          </Link>
        </div>
      </nav>

      <main className="relative min-h-screen overflow-hidden">
        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="relative pt-36 pb-20 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* left: copy */}
          <div>
            <p
              className="landing-stagger-1 text-xs font-medium tracking-[0.2em] uppercase mb-6"
              style={{ color: 'var(--subtle)' }}
            >
              Privacy-first scheduling
            </p>

            <h1
              className="landing-stagger-2 leading-[1.08] mb-6"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(2.8rem, 5.5vw, 4.2rem)',
                fontWeight: 400,
                color: 'var(--foreground)',
              }}
            >
              Share when you&apos;re{' '}
              <em className="not-italic" style={{ color: 'var(--accent)' }}>
                free
              </em>
              .<br />
              Not what you&apos;re doing.
            </h1>

            <p
              className="landing-stagger-3 text-lg leading-relaxed max-w-md mb-10"
              style={{ color: 'var(--muted)' }}
            >
              Connect your calendars. Get a clean free/busy view. Schedule with groups — no event
              titles, descriptions, or attendees ever shared.
            </p>

            <div className="landing-stagger-4 flex flex-wrap items-center gap-4">
              <Link
                href="/availability/connect"
                className="group relative inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium transition-all"
                style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--btn-bg-hover)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px var(--card-shadow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--btn-bg)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Get started
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link
                href="/sessions/new"
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ border: '1px solid var(--secondary-border)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </span>
                Plan with a group
              </Link>
            </div>
          </div>

          {/* right: animated calendar grid */}
          <div className="landing-grid-reveal relative flex justify-center lg:justify-end">
            <div className="landing-float relative">
              {/* soft shadow card */}
              <div
                className="rounded-3xl p-6 sm:p-8"
                style={{
                  background: `linear-gradient(145deg, var(--card-from) 0%, var(--card-to) 100%)`,
                  boxShadow: `0 30px 80px -20px var(--card-shadow), 0 0 0 1px var(--card-ring)`,
                }}
              >
                {/* header row */}
                <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `40px repeat(${DAYS.length}, 1fr)` }}>
                  <div />
                  {DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-medium tracking-wider uppercase"
                      style={{ color: 'var(--subtle)' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* grid body */}
                <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(${DAYS.length}, 1fr)` }}>
                  {HOURS.map((hour, hi) =>
                    [
                      <div
                        key={`h-${hi}`}
                        className="text-[10px] font-mono flex items-center justify-end pr-2"
                        style={{ height: 28, color: 'var(--subtle)' }}
                      >
                        {hour}
                      </div>,
                      ...DAYS.map((_, di) => {
                        const isBusy = BUSY[di][hi];
                        const delay = mounted ? `${0.6 + (di * HOURS.length + hi) * 0.025}s` : '0s';
                        return (
                          <div
                            key={`${di}-${hi}`}
                            className="landing-slot-animate rounded-md"
                            style={{
                              height: 28,
                              animationDelay: delay,
                              background: isBusy
                                ? `linear-gradient(135deg, var(--slot-busy-from) 0%, var(--slot-busy-to) 100%)`
                                : 'var(--slot-free)',
                              opacity: mounted ? undefined : 0,
                            }}
                          />
                        );
                      }),
                    ]
                  )}
                </div>

                {/* legend */}
                <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--subtle)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--slot-free)' }} />
                    Free
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--subtle)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `linear-gradient(135deg, var(--slot-busy-from) 0%, var(--slot-busy-to) 100%)` }} />
                    Busy
                  </span>
                </div>
              </div>

              {/* decorative badge */}
              <div
                className="absolute -top-3 -right-3 rounded-full px-3 py-1.5 text-[10px] font-medium shadow-md"
                style={{
                  animation: 'landing-fade-in 0.6s ease 1.6s both',
                  background: 'var(--badge-bg)',
                  color: 'var(--muted)',
                  border: `1px solid var(--badge-border)`,
                }}
              >
                ✦ No event details shared
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES STRIP ───────────────────────────────── */}
        <section
          className="landing-stagger-5"
          style={{ borderTop: '1px solid var(--border)', background: `linear-gradient(to bottom, var(--surface), transparent)` }}
        >
          <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                title: 'Privacy-first',
                desc: 'Event titles, descriptions, and attendees are stripped before anything is shared.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                ),
                title: 'Any calendar',
                desc: 'Google Calendar, Outlook, or upload a .ics file — no account required.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                ),
                title: 'Group scheduling',
                desc: 'One invite link. Anonymous availability. Common free slots surfaced instantly.',
              },
            ].map((f) => (
              <div key={f.title} className="group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors"
                  style={{ background: 'var(--icon-bg)', color: 'var(--muted)' }}
                >
                  {f.icon}
                </div>
                <p className="font-medium mb-1.5 text-sm" style={{ color: 'var(--foreground)' }}>{f.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--subtle)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid var(--border)' }} className="px-6 py-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px]" style={{ color: 'var(--subtle)' }}>
            <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '0.85rem' }}>
              CalShare
            </span>
            <span>Privacy-first availability sharing</span>
          </div>
        </footer>
      </main>
    </>
  );
}
