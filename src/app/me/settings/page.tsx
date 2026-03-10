'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { participantName, participantColor } from '@/lib/participant-names';

// Curated palette — same saturation/lightness as participantColor for coherency
const COLOR_PALETTE = [
  0, 25, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
].map(hue => `hsl(${hue}, 35%, 65%)`);

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const prefs = state.preferences;

  const autoName = state.sessionId ? participantName(state.sessionId) : '';
  const autoColor = state.sessionId ? participantColor(state.sessionId) : COLOR_PALETTE[0];
  const currentName = state.displayName || autoName;
  const currentColor = state.userColor || autoColor;

  const [name, setName] = useState(currentName);
  const [color, setColor] = useState(currentColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = name !== currentName || color !== currentColor;

  async function saveProfile() {
    const trimmedName = name.trim();
    const newName = trimmedName && trimmedName !== autoName ? trimmedName : null;
    const newColor = color !== autoColor ? color : null;

    // Update local state
    dispatch({ type: 'SET_DISPLAY_NAME', name: newName });
    dispatch({ type: 'SET_USER_COLOR', color: newColor });

    // Save to DB
    if (state.sessionId && state.organizerToken) {
      setSaving(true);
      try {
        await fetch(`/api/sessions/${state.sessionId}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.organizerToken}`,
          },
          body: JSON.stringify({ displayName: newName, userColor: newColor }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // localStorage already updated as fallback
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <main className="page-container page-container--narrow">
      <button onClick={() => router.back()} className="back-link">
        &larr; Back
      </button>

      <h1 className="page-title mb-8">Settings</h1>

      {/* Identity */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Identity</h2>

        <div className="mb-4">
          <label className="label">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            style={{ maxWidth: '16rem' }}
            maxLength={30}
            placeholder={autoName || 'Your name'}
          />
        </div>

        <div className="mb-4">
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={saving || !hasChanges}
            onClick={saveProfile}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
          {saved && <span className="text-xs" style={{ color: 'var(--success)' }}>Visible to everyone in your groups</span>}
        </div>
      </section>

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
    </main>
  );
}
