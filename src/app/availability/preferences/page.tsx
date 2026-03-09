'use client';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import type { Weekday } from '@/types';

const DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PreferencesPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const prefs = state.preferences;

  function toggleDay(day: Weekday) {
    dispatch({
      type: 'SET_PREFERENCES',
      preferences: {
        ...prefs,
        workingHours: {
          ...prefs.workingHours,
          [day]: prefs.workingHours[day] ? null : { start: '09:00', end: '17:00' },
        },
      },
    });
  }

  function updateHours(day: Weekday, field: 'start' | 'end', value: string) {
    const current = prefs.workingHours[day];
    if (!current) return;
    dispatch({
      type: 'SET_PREFERENCES',
      preferences: {
        ...prefs,
        workingHours: {
          ...prefs.workingHours,
          [day]: { ...current, [field]: value },
        },
      },
    });
  }

  return (
    <main className="max-w-xl mx-auto py-12 px-4">
      <button
        onClick={() => router.back()}
        className="text-sm text-stone-600 hover:underline mb-6 flex items-center gap-1"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold mb-8">Availability Preferences</h1>

      {/* Working hours */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-4">Working hours</h2>
        <div className="space-y-3">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`day-${day}`}
                checked={!!prefs.workingHours[day]}
                onChange={() => toggleDay(day)}
                className="w-4 h-4"
              />
              <label htmlFor={`day-${day}`} className="w-8 text-sm font-medium select-none">
                {day}
              </label>
              {prefs.workingHours[day] && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={prefs.workingHours[day]!.start}
                    onChange={(e) => updateHours(day, 'start', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <span className="text-stone-400 text-sm">to</span>
                  <input
                    type="time"
                    value={prefs.workingHours[day]!.end}
                    onChange={(e) => updateHours(day, 'end', e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Buffer time */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-2">Buffer between meetings</h2>
        <p className="text-sm text-stone-400 mb-3">
          Adds a gap after each busy block before marking you as available.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={prefs.bufferMinutes}
            onChange={(e) =>
              dispatch({
                type: 'SET_PREFERENCES',
                preferences: { ...prefs, bufferMinutes: Number(e.target.value) },
              })
            }
            className="flex-1"
          />
          <span className="text-sm font-medium w-16 text-right">{prefs.bufferMinutes} min</span>
        </div>
      </section>

      {/* Look-ahead window */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-2">Look-ahead window</h2>
        <p className="text-sm text-stone-400 mb-3">
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
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {[7, 14, 21, 30].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </section>

      <p className="text-xs text-stone-400">Preferences are saved automatically to your browser.</p>
    </main>
  );
}
