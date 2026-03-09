'use client';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  source: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AnonymisationPreview({ blocks, source, onConfirm, onCancel }: Props) {
  const preview = blocks.slice(0, 8);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold mb-1">Your calendar data has been anonymised</h2>
        <p className="text-sm text-gray-500 mb-5">Source: {source}</p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-sm font-medium text-red-600 mb-2">What we REMOVED</p>
            {['Event titles', 'Descriptions', 'Attendees', 'Locations', 'Organiser'].map(item => (
              <p key={item} className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-red-400">✕</span> {item}
              </p>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-green-600 mb-2">What we KEPT</p>
            {['Start time', 'End time', 'Busy / Free'].map(item => (
              <p key={item} className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-green-500">✓</span> {item}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-5">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            Preview — this is ALL we see ({blocks.length} block{blocks.length !== 1 ? 's' : ''})
          </p>
          {blocks.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No busy blocks found in this calendar.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {preview.map((b, i) => (
                <div key={i} className="text-xs font-mono text-gray-700">
                  {b.allDay
                    ? `${b.start}  (all day)  ${b.busy ? 'busy' : 'free'}`
                    : `${new Date(b.start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → ${new Date(b.end).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}  ${b.busy ? 'busy' : 'free'}`
                  }
                </div>
              ))}
              {blocks.length > 8 && (
                <p className="text-xs text-gray-400 italic">… and {blocks.length - 8} more blocks</p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-5">
          Raw event data has been discarded and is never stored or transmitted.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Continue
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel &amp; disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
