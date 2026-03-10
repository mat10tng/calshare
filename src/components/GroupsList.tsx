'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GroupEntry } from '@/types';

interface Props {
  groups: GroupEntry[];
  onRename: (sessionId: string, name: string) => void;
  onLeave: (sessionId: string) => void;
  onCreateClick?: () => void;
}

export function GroupsList({ groups, onRename, onLeave, onCreateClick }: Props) {
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

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Groups</h2>
        {onCreateClick && (
          <button
            className="inline-flex items-center justify-center w-5 h-5 rounded text-sm leading-none"
            style={{ color: 'var(--subtle)', border: '1px solid var(--border)' }}
            onClick={onCreateClick}
            title="Create a new group"
          >
            +
          </button>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>No groups yet</p>
      ) : (
      <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
        {groups.map((group, i) => (
          <li
            key={group.sessionId}
            className="px-4 py-3"
            style={{
              background: 'var(--card-bg)',
              borderTop: i > 0 ? '1px solid var(--border)' : undefined,
            }}
          >
            {/* Name row */}
            <div className="flex items-center gap-2 mb-2">
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
                  className="input flex-1"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                />
              ) : (
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{group.name}</span>
              )}
              <span className="text-xs capitalize" style={{ color: 'var(--subtle)' }}>{group.role}</span>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                {new Date(group.joinedAt).toLocaleDateString()}
              </span>
            </div>
            {/* Action row */}
            <div className="flex gap-2 flex-wrap">
              <Link href={`/sessions/${group.sessionId}`} className="btn btn-secondary btn-sm">
                Open
              </Link>
              <button onClick={() => copyLink(group.sessionId)} className="btn btn-secondary btn-sm">
                {copiedId === group.sessionId ? '✓ Copied' : 'Copy link'}
              </button>
              <button onClick={() => startRename(group)} className="btn btn-ghost btn-sm">
                Rename
              </button>
              {leavingId === group.sessionId ? (
                <>
                  <span className="text-xs self-center" style={{ color: 'var(--subtle)' }}>Remove from list?</span>
                  <button
                    onClick={() => { onLeave(group.sessionId); setLeavingId(null); }}
                    className="btn btn-sm"
                    style={{ background: 'var(--surface)', color: 'var(--error)' }}
                  >
                    Yes, remove
                  </button>
                  <button onClick={() => setLeavingId(null)} className="btn btn-ghost btn-sm">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setLeavingId(group.sessionId)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--subtle)' }}
                >
                  Leave
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
