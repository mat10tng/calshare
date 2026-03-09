'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GroupEntry } from '@/types';

interface Props {
  groups: GroupEntry[];
  onRename: (sessionId: string, name: string) => void;
  onLeave: (sessionId: string) => void;
}

export function GroupsList({ groups, onRename, onLeave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function startRename(group: GroupEntry) {
    setEditingId(group.sessionId);
    setEditName(group.name);
  }

  function commitRename(sessionId: string) {
    const trimmed = editName.trim();
    if (trimmed) onRename(sessionId, trimmed);
    setEditingId(null);
  }

  async function copyLink(sessionId: string) {
    const url = `${window.location.origin}/sessions/${sessionId}/join`;
    await navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (groups.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Your Groups</h2>
      </div>
      <ul className="divide-y border rounded-xl overflow-hidden">
        {groups.map((group) => (
          <li key={group.sessionId} className="px-4 py-3 bg-white">
            {/* Name row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🗓</span>
              {editingId === group.sessionId ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(group.sessionId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(group.sessionId);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 border rounded px-2 py-0.5 text-sm"
                />
              ) : (
                <span className="flex-1 text-sm font-medium">{group.name}</span>
              )}
              <span className="text-xs text-stone-400 capitalize">{group.role}</span>
              <span className="text-xs text-stone-400">
                {new Date(group.joinedAt).toLocaleDateString()}
              </span>
            </div>
            {/* Action row */}
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/sessions/${group.sessionId}`}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
              >
                Open
              </Link>
              <button
                onClick={() => copyLink(group.sessionId)}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
              >
                {copiedId === group.sessionId ? '✓ Copied' : 'Copy link'}
              </button>
              <button
                onClick={() => startRename(group)}
                className="text-xs border rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
              >
                Rename
              </button>
              {leavingId === group.sessionId ? (
                <>
                  <span className="text-xs text-stone-400 self-center">Remove from list?</span>
                  <button
                    onClick={() => { onLeave(group.sessionId); setLeavingId(null); }}
                    className="text-xs border border-stone-300 text-stone-500 rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setLeavingId(null)}
                    className="text-xs border rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setLeavingId(group.sessionId)}
                  className="text-xs border border-stone-300 text-stone-500 rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
                >
                  Leave
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
