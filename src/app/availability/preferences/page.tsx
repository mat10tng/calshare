'use client';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

export default function PreferencesPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const prefs = state.preferences;

  return (
    <main className="page-container page-container--narrow">
      <button onClick={() => router.back()} className="back-link">
        &larr; Back
      </button>

      <h1 className="page-title mb-8">Preferences</h1>

      {/* Look-ahead window */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Look-ahead window</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--subtle)' }}>
          How far ahead to show availability.
        </p>
        <select
          value={prefs.lookAheadDays}
          onChange={(e) =>
            dispatch({
              type: 'SET_PREFERENCES',
              preferences: { ...prefs, lookAheadDays: Number(e.target.value) },
            })
          }
          className="input"
          style={{ width: 'auto' }}
        >
          {[7, 14, 21, 30].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </section>

      <p className="text-xs" style={{ color: 'var(--subtle)' }}>Preferences are saved automatically to your browser.</p>
    </main>
  );
}
