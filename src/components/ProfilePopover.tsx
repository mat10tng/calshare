'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { participantName, participantColor } from '@/lib/participant-names';

const COLOR_PALETTE = [
  0, 25, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
].map(hue => `hsl(${hue}, 35%, 65%)`);

export function ProfilePopover() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sessionId = state.sessionId;
  if (!sessionId) return null;

  const autoName = participantName(sessionId);
  const autoColor = participantColor(sessionId);
  const displayName = state.displayName || autoName;
  const displayColor = state.userColor || autoColor;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: 'var(--subtle)', cursor: 'pointer' }}
      >
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: displayColor }}
        />
        {displayName}
      </button>
      {open && (
        <ProfilePanel
          sessionId={sessionId}
          autoName={autoName}
          autoColor={autoColor}
          onClose={() => setOpen(false)}
          containerRef={ref}
        />
      )}
    </div>
  );
}

function ProfilePanel({
  sessionId,
  autoName,
  autoColor,
  onClose,
  containerRef,
}: {
  sessionId: string;
  autoName: string;
  autoColor: string;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { state, dispatch } = useApp();
  const [name, setName] = useState(state.displayName || autoName);
  const [color, setColor] = useState(state.userColor || autoColor);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, containerRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function save() {
    const trimmed = name.trim();
    const newName = trimmed && trimmed !== autoName ? trimmed : null;
    const newColor = color !== autoColor ? color : null;

    dispatch({ type: 'SET_DISPLAY_NAME', name: newName });
    dispatch({ type: 'SET_USER_COLOR', color: newColor });

    if (state.organizerToken) {
      setSaving(true);
      try {
        await fetch(`/api/sessions/${sessionId}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.organizerToken}`,
          },
          body: JSON.stringify({ displayName: newName, userColor: newColor }),
        });
      } catch { /* localStorage fallback */ }
      finally { setSaving(false); }
    }
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 rounded-lg p-3"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px var(--card-shadow)',
        width: 220,
      }}
    >
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
        Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        className="input mb-2"
        style={{ fontSize: '0.8125rem' }}
        maxLength={30}
        placeholder={autoName}
        autoFocus
      />
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
        Color
      </label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-5 h-5 rounded-full transition-all"
            style={{
              background: c,
              boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 3px ${c}` : 'none',
            }}
          />
        ))}
      </div>
      <button
        className="btn btn-primary btn-sm w-full"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
