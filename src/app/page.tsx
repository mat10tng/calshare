import Link from 'next/link';
import { Nav } from '@/components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto py-24 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4 leading-tight text-stone-800">
          Share when you&apos;re free.<br />
          <span className="text-stone-500">Not what you&apos;re doing.</span>
        </h1>
        <p className="text-stone-500 text-lg mb-10 max-w-lg mx-auto">
          Connect your calendars, get a privacy-first free/busy view, and
          schedule with groups — without sharing event titles, descriptions, or attendees.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16 text-left">
          <div className="border border-stone-200 rounded-2xl p-6 hover:border-stone-300 transition-colors">
            <p className="text-3xl mb-3">📅</p>
            <h2 className="text-lg font-bold mb-2 text-stone-800">Share my schedule</h2>
            <p className="text-sm text-stone-500 mb-5">
              Generate a link that shows when you&apos;re free — privately. No event details shared.
            </p>
            <Link
              href="/availability/connect"
              className="inline-block bg-stone-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              Get started →
            </Link>
          </div>

          <div className="border border-stone-200 rounded-2xl p-6 hover:border-stone-300 transition-colors">
            <p className="text-3xl mb-3">👥</p>
            <h2 className="text-lg font-bold mb-2 text-stone-800">Plan with a group</h2>
            <p className="text-sm text-stone-500 mb-5">
              Find a time that works for everyone. Invite friends with one link — no accounts needed.
            </p>
            <Link
              href="/sessions/new"
              className="inline-block border border-stone-300 rounded-xl px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Create session →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: '🔒',
              title: 'Privacy-first',
              desc: 'Event titles, descriptions, and attendees are stripped before any data is shared.',
            },
            {
              icon: '📅',
              title: 'Any calendar',
              desc: 'Connect Google Calendar, Outlook, or upload a .ics file — no account required.',
            },
            {
              icon: '👥',
              title: 'Group scheduling',
              desc: 'Share an invite link. Everyone contributes anonymised availability. See common free slots.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-stone-50 rounded-xl p-5">
              <p className="text-2xl mb-2">{f.icon}</p>
              <p className="font-semibold mb-1 text-stone-700">{f.title}</p>
              <p className="text-sm text-stone-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
