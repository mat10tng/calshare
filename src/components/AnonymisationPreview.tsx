'use client';
import { useEffect, useState } from 'react';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  source: string;
  onConfirm: (blocks: BusyBlock[]) => void;
  onCancel: () => void;
}

export function AnonymisationPreview({ blocks, source, onConfirm, onCancel }: Props) {
  const [includeTitle, setIncludeTitle] = useState(false);

  const preview = blocks.slice(0, 8);
  const hasTitles = blocks.some((b) => b.title);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const formatEnd = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  function handleConfirm() {
    const finalBlocks = includeTitle
      ? blocks
      : blocks.map(({ title: _t, ...b }) => b as BusyBlock);
    onConfirm(finalBlocks);
  }

  const removedItems = [
    'Descriptions',
    'Attendees',
    'Locations',
    'Organiser',
    ...(!includeTitle ? ['Event titles'] : []),
  ];
  const keptItems = [
    'Start time',
    'End time',
    'Busy / Free',
    ...(includeTitle && hasTitles ? ['Event titles'] : []),
  ];

  return (
    <div className="modal-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-preview-title"
        className="modal-panel"
      >
        <h2 id="anon-preview-title" className="text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
          Your calendar data has been anonymised
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--subtle)' }}>Source: {source}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>What we REMOVED</p>
            {removedItems.map(item => (
              <p key={item} className="text-sm flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--error)' }}>&times;</span> {item}
              </p>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--success)' }}>What we KEPT</p>
            {keptItems.map(item => (
              <p key={item} className="text-sm flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--success)' }}>&#10003;</span> {item}
              </p>
            ))}
          </div>
        </div>

        {/* Detail opt-in */}
        <div className="card--surface rounded-lg p-3 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--subtle)' }}>Optional details</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTitle}
              onChange={(e) => setIncludeTitle(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              Include event titles
              {hasTitles
                ? <span className="text-xs ml-1" style={{ color: 'var(--subtle)' }}>(found in your calendar)</span>
                : <span className="text-xs ml-1" style={{ color: 'var(--subtle)' }}>(none found in this calendar)</span>
              }
            </span>
          </label>
          {includeTitle && (
            <p className="text-xs mt-2 ml-6" style={{ color: 'var(--warning)' }}>
              Event titles will be visible to group session organisers when you join a session.
            </p>
          )}
        </div>

        <div className="rounded-lg p-3 mb-5" style={{ background: 'var(--surface)' }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--subtle)' }}>
            Preview — this is ALL we see ({blocks.length} block{blocks.length !== 1 ? 's' : ''})
          </p>
          {blocks.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--subtle)' }}>No busy blocks found in this calendar.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {preview.map((b, i) => (
                <div key={i} className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {b.allDay
                    ? `${b.start}  (all day)  ${b.busy ? 'busy' : 'free'}`
                    : `${formatTime(b.start)} → ${formatEnd(b.end)}  ${b.busy ? 'busy' : 'free'}`
                  }
                  {includeTitle && b.title && (
                    <span className="ml-2" style={{ color: 'var(--foreground)' }}>&quot;{b.title}&quot;</span>
                  )}
                </div>
              ))}
              {blocks.length > 8 && (
                <p className="text-xs italic" style={{ color: 'var(--subtle)' }}>… and {blocks.length - 8} more blocks</p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs mb-5" style={{ color: 'var(--subtle)' }}>
          {includeTitle
            ? 'Event titles will be stored locally and included when sharing with a session.'
            : 'Raw event data has been discarded and is never stored or transmitted.'
          }
        </p>

        <div className="flex gap-3">
          <button onClick={handleConfirm} autoFocus className="btn btn-primary flex-1 justify-center">
            Continue
          </button>
          <button onClick={onCancel} className="btn btn-secondary flex-1 justify-center">
            Cancel &amp; disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
