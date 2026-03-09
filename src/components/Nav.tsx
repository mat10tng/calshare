import Link from 'next/link';

export function Nav() {
  return (
    <nav className="border-b px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-blue-600 text-lg">
        CalShare
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/availability" className="text-gray-600 hover:text-gray-900 transition-colors">
          My Availability
        </Link>
        <Link
          href="/sessions/new"
          className="bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors"
        >
          Group Session
        </Link>
      </div>
    </nav>
  );
}
