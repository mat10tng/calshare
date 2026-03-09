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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-preview-title"
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
      >
        <h2 id="anon-preview-title" className="text-xl font-semibold mb-1">Your calendar data has been anonymised</h2>
        <p className="text-sm text-stone-400 mb-5">Source: {source}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-stone-500 mb-2">What we REMOVED</p>
            {removedItems.map(item => (
              <p key={item} className="text-sm text-stone-500 flex items-center gap-1">
                <span className="text-red-400">✕</span> {item}
              </p>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-green-600 mb-2">What we KEPT</p>
            {keptItems.map(item => (
              <p key={item} className="text-sm text-stone-500 flex items-center gap-1">
                <span className="text-green-500">✓</span> {item}
              </p>
            ))}
          </div>
        </div>

        {/* Detail opt-in */}
        <div className="border rounded-lg p-3 mb-4 bg-stone-50">
          <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wide">Optional details</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTitle}
              onChange={(e) => setIncludeTitle(e.target.checked)}
              className="mt-0.5 accent-stone-800"
            />
            <span className="text-sm text-stone-600">
              Include event titles
              {hasTitles
                ? <span className="text-stone-400 text-xs ml-1">(found in your calendar)</span>
                : <span className="text-stone-400 text-xs ml-1">(none found in this calendar)</span>
              }
            </span>
          </label>
          {includeTitle && (
            <p className="text-xs text-amber-700 mt-2 ml-6">
              Event titles will be visible to group session organisers when you join a session.
            </p>
          )}
        </div>

        <div className="bg-stone-50 rounded-lg p-3 mb-5">
          <p className="text-xs font-medium text-stone-400 mb-2 uppercase tracking-wide">
            Preview — this is ALL we see ({blocks.length} block{blocks.length !== 1 ? 's' : ''})
          </p>
          {blocks.length === 0 ? (
            <p className="text-xs text-stone-400 italic">No busy blocks found in this calendar.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {preview.map((b, i) => (
                <div key={i} className="text-xs font-mono text-stone-600">
                  {b.allDay
                    ? `${b.start}  (all day)  ${b.busy ? 'busy' : 'free'}`
                    : `${formatTime(b.start)} → ${formatEnd(b.end)}  ${b.busy ? 'busy' : 'free'}`
                  }
                  {includeTitle && b.title && (
                    <span className="text-stone-600 ml-2">&quot;{b.title}&quot;</span>
                  )}
                </div>
              ))}
              {blocks.length > 8 && (
                <p className="text-xs text-stone-400 italic">… and {blocks.length - 8} more blocks</p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-stone-400 mb-5">
          {includeTitle
            ? 'Event titles will be stored locally and included when sharing with a session.'
            : 'Raw event data has been discarded and is never stored or transmitted.'
          }
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            autoFocus
            className="flex-1 bg-stone-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Continue
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-stone-200 rounded-lg py-2 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Cancel &amp; disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
