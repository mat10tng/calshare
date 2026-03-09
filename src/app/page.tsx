import Link from 'next/link';
import { Nav } from '@/components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto py-24 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Share when you&apos;re free.<br />
          <span className="text-blue-600">Not what you&apos;re doing.</span>
        </h1>
        <p className="text-gray-600 text-lg mb-10 max-w-lg mx-auto">
          Connect your calendars, get a privacy-first free/busy view, and
          schedule with groups — without sharing event titles, descriptions, or attendees.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-16">
          <Link
            href="/availability/connect"
            className="bg-blue-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/sessions/new"
            className="border-2 border-gray-200 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition-colors"
          >
            Schedule with a group
          </Link>
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
            <div key={f.title} className="bg-gray-50 rounded-xl p-5">
              <p className="text-2xl mb-2">{f.icon}</p>
              <p className="font-semibold mb-1">{f.title}</p>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
