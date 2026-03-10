'use client';
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import type { BusyBlock, Proposal } from '@/types';
import { participantName, participantColor } from '@/lib/participant-names';
import { ProfilePopover } from '@/components/ProfilePopover';

interface Participant {
  id: string;
  blocks: BusyBlock[];
  displayName?: string;
  userColor?: string;
}

const EMPTY_BLOCKS: BusyBlock[] = [];

export default function GroupPage() {
  return (
    <Suspense fallback={<><Nav /><main className="page-container"><p className="text-sm" style={{ color: 'var(--subtle)' }}>Loading…</p></main></>}>
      <GroupPageInner />
    </Suspense>
  );
}

function GroupPageInner() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('id') ?? '';
  const { state, dispatch } = useApp();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [personalSessionMap, setPersonalSessionMap] = useState<Record<string, string>>({});
  const [quorum, setQuorum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // "Suggest a time" — title modal
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);

  // Active proposal — grid is in suggest mode for this proposal
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [hiddenProposalIds, setHiddenProposalIds] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [editingProposalTitle, setEditingProposalTitle] = useState('');

  // Keep user identity in URL
  useEffect(() => {
    if (!state.sessionId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('id') !== groupId) return; // don't touch if group id param is set
    // We keep the group id as the primary ?id= param
  }, [state.sessionId, groupId]);

  const fetchSession = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/sessions/${groupId}`);
    if (!res.ok) return;
    const data = await res.json();
    setGroupName(data.name ?? null);
    setParticipants(data.participants);
    setQuorum(data.quorum);
    setPersonalSessionMap(data.personalSessionMap ?? {});
    setProposals(data.proposals ?? []);
    setLoading(false);
  }, [groupId]);

  const myParticipantId = useMemo(() => {
    if (!state.sessionId) return undefined;
    for (const [pid, psid] of Object.entries(personalSessionMap)) {
      if (psid === state.sessionId) return pid;
    }
    return undefined;
  }, [state.sessionId, personalSessionMap]);

  useEffect(() => {
    if (!groupId) return;
    fetchSession();
    const interval = setInterval(fetchSession, 10_000);
    return () => clearInterval(interval);
  }, [groupId, fetchSession]);

  const joinLink = typeof window !== 'undefined' && groupId
    ? `${window.location.origin}/group?id=${groupId}`
    : '';

  async function copyLink() {
    await navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Create proposal (title only), then activate it for range selection
  async function createProposal() {
    if (!proposalTitle.trim() || !myParticipantId) return;
    setProposalLoading(true);
    try {
      const res = await fetch(`/api/sessions/${groupId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: proposalTitle.trim(), participantId: myParticipantId }),
      });
      if (!res.ok) return;
      const { proposal } = await res.json();
      await fetchSession();
      setShowTitleModal(false);
      setProposalTitle('');
      // Activate the new proposal so user can immediately select their range
      setActiveProposalId(proposal.id);
    } finally {
      setProposalLoading(false);
    }
  }

  // When user toggles cells on the grid while a proposal is active, save as their vote
  async function handleSuggestCellsChange(cells: string[]) {
    if (!activeProposalId || !myParticipantId) return;
    await fetch(`/api/sessions/${groupId}/proposals/${activeProposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId, cells }),
    });
    await fetchSession();
  }

  async function handleJoinGroup() {
    if (!groupId) return;
    setJoining(true);
    setJoinError(null);
    try {
      // Ensure personal session exists
      let personalId = state.sessionId;
      let personalToken = state.organizerToken;
      if (!personalId || !personalToken) {
        const pRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quorum: 1, lookAheadDays: 14, type: 'personal' }),
        });
        if (!pRes.ok) throw new Error('Failed to create personal session');
        const p = await pRes.json();
        personalId = p.sessionId as string;
        personalToken = p.organizerToken as string;
        dispatch({ type: 'SET_SESSION', sessionId: personalId, organizerToken: personalToken });
      }

      // Sync blocks
      await fetch(`/api/sessions/${personalId}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${personalToken}` },
        body: JSON.stringify({ blocks: state.blocks }),
      });

      // Join
      const joinRes = await fetch(`/api/sessions/${groupId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: groupId, personalSessionId: personalId }),
      });
      const joinData = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) {
        throw new Error((joinData as { error?: string }).error ?? 'Failed to join group.');
      }

      const { participantId } = joinData as { participantId: string };
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId: groupId,
          role: 'participant',
          participantId,
          name: groupName || `Group ${groupId}`,
          joinedAt: new Date().toISOString(),
        },
      });

      await fetchSession();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join.');
    } finally {
      setJoining(false);
    }
  }

  async function dismissProposal(proposalId: string) {
    if (!myParticipantId) return;
    await fetch(`/api/sessions/${groupId}/proposals/${proposalId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId }),
    });
    if (activeProposalId === proposalId) setActiveProposalId(null);
    await fetchSession();
  }

  async function renameProposal(proposalId: string, title: string) {
    if (!myParticipantId || !title.trim()) return;
    await fetch(`/api/sessions/${groupId}/proposals/${proposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId, title: title.trim() }),
    });
    setEditingProposalId(null);
    await fetchSession();
  }

  function formatVoteCells(cells: string[]): string {
    if (!Array.isArray(cells) || cells.length === 0) return '—';
    const byDate = new Map<string, number[]>();
    for (const c of cells) {
      const [d, h] = c.split(':');
      const arr = byDate.get(d);
      if (arr) arr.push(Number(h)); else byDate.set(d, [Number(h)]);
    }
    const weekday = (d: string) => new Date(d + 'T00:00:00.000Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const time = (h: number) => `${String(h).padStart(2, '0')}:00`;
    const parts: string[] = [];
    for (const [d, hours] of byDate) {
      hours.sort((a, b) => a - b);
      parts.push(`${weekday(d)} ${time(hours[0])}\u2009\u2013\u2009${time(hours[hours.length - 1] + 1)}`);
    }
    return parts.join(', ');
  }

  function nameOf(pid: string) {
    const p = participants.find(pp => pp.id === pid);
    return p?.displayName || participantName(pid);
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + state.preferences.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  const gridWrapperRef = useRef<HTMLDivElement>(null);

  const highlightProposal = useCallback((proposalId: string) => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const cells = wrapper.querySelectorAll<HTMLElement>('.grid-cell');
    cells.forEach(cell => {
      const ids = cell.getAttribute('data-proposals');
      if (ids && ids.split(' ').includes(proposalId)) {
        cell.classList.add('grid-cell-proposal--active');
      } else {
        cell.classList.add('grid-cell-proposal--dimmed');
      }
    });
  }, []);

  const clearHighlight = useCallback(() => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const cells = wrapper.querySelectorAll<HTMLElement>('.grid-cell');
    cells.forEach(cell => {
      cell.classList.remove('grid-cell-proposal--dimmed', 'grid-cell-proposal--active');
    });
  }, []);

  // Highlight active proposal cells on calendar when in suggest mode
  useEffect(() => {
    if (activeProposalId) {
      const t = setTimeout(() => highlightProposal(activeProposalId), 50);
      return () => clearTimeout(t);
    } else {
      clearHighlight();
    }
  }, [activeProposalId, highlightProposal, clearHighlight]);

  const activeProposal = proposals.find(p => p.id === activeProposalId) ?? null;
  const suggestMode = !!activeProposalId;

  const myInitialSuggestCells = useMemo<string[]>(() => {
    if (!activeProposal || !myParticipantId) return [];
    const myVote = activeProposal.votes[myParticipantId];
    if (!Array.isArray(myVote)) return [];
    return myVote;
  }, [activeProposal, myParticipantId]);

  return (
    <>
      <Nav />
      <main className="page-container">
        <Link href="/me" className="back-link">&larr; Back</Link>

        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{groupName || `Group ${groupId}`}</h1>
              <button onClick={copyLink} className="btn btn-secondary btn-sm">
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
            <p className="page-subtitle">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {!loading && !myParticipantId && (
          <div className="flex items-center gap-3 mb-6 rounded-lg px-4 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>You&apos;re not a member of this group.</span>
            <button
              onClick={handleJoinGroup}
              disabled={joining}
              className="btn btn-primary btn-sm"
            >
              {joining ? 'Joining…' : 'Join group'}
            </button>
            {joinError && <span className="text-xs" style={{ color: 'var(--error)' }}>{joinError}</span>}
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Loading participant availability…</p>
        ) : (
          <>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-4 mb-3"
              style={{
                minHeight: 44,
                background: suggestMode ? 'var(--surface)' : 'transparent',
                border: suggestMode ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {suggestMode ? (
                <>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {activeProposal?.title}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                    Click or drag to pick your times
                  </span>
                  <button
                    className="btn btn-sm btn-ghost ml-auto"
                    onClick={() => setActiveProposalId(null)}
                  >
                    Done
                  </button>
                </>
              ) : myParticipantId && (
                <ProfilePopover />
              )}
            </div>
            <div ref={gridWrapperRef}>
              <AvailabilityGrid
                blocks={EMPTY_BLOCKS}
                fromDate={now}
                toDate={until}
                participants={participants}
                editableParticipantId={suggestMode ? undefined : myParticipantId}
                onBlocksChange={!suggestMode && myParticipantId ? (newBlocks) => {
                  dispatch({ type: 'SET_BLOCKS', blocks: newBlocks });
                } : undefined}
                suggestMode={suggestMode}
                initialSuggestCells={myInitialSuggestCells}
                onSuggestCellsChange={suggestMode ? handleSuggestCellsChange : undefined}
                proposals={proposals.filter(p => !hiddenProposalIds.has(p.id))}
              />
            </div>

            {/* Proposals list */}
            {myParticipantId && (
              <div className="flex items-center gap-2 mt-8 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Meetups</h2>
                {!suggestMode && (
                  <button
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-sm leading-none"
                    style={{ color: 'var(--subtle)', border: '1px solid var(--border)' }}
                    onClick={() => { setShowTitleModal(true); setProposalTitle(''); }}
                    title="Suggest a time"
                  >
                    +
                  </button>
                )}
              </div>
            )}
            {proposals.length > 0 && (
              <>
                <div className="flex flex-col gap-3">
                  {proposals.map((proposal) => {
                    const voteEntries = Object.entries(proposal.votes)
                      .filter(([, v]) => Array.isArray(v) && v.length > 0);
                    const isCreator = myParticipantId === proposal.createdBy;
                    const isActive = activeProposalId === proposal.id;
                    const myVote = myParticipantId ? proposal.votes[myParticipantId] : undefined;

                    return (
                      <div
                        key={proposal.id}
                        className="card"
                        style={{ cursor: 'pointer', ...(isActive ? { borderColor: 'var(--accent)', background: 'var(--surface)' } : undefined) }}
                        onClick={() => myParticipantId && setActiveProposalId(isActive ? null : proposal.id)}
                        onMouseEnter={() => !suggestMode && highlightProposal(proposal.id)}
                        onMouseLeave={() => !suggestMode && clearHighlight()}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {editingProposalId === proposal.id ? (
                              <input
                                className="input text-sm font-medium"
                                style={{ padding: '0.125rem 0.375rem', maxWidth: '16rem' }}
                                value={editingProposalTitle}
                                onChange={(e) => setEditingProposalTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') renameProposal(proposal.id, editingProposalTitle);
                                  if (e.key === 'Escape') setEditingProposalId(null);
                                }}
                                onBlur={() => renameProposal(proposal.id, editingProposalTitle)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                maxLength={100}
                              />
                            ) : (
                              <p
                                className="text-sm font-medium"
                                style={{ color: 'var(--foreground)', cursor: myParticipantId ? 'text' : undefined }}
                                onClick={(e) => {
                                  if (!myParticipantId) return;
                                  e.stopPropagation();
                                  setEditingProposalId(proposal.id);
                                  setEditingProposalTitle(proposal.title);
                                }}
                                title={myParticipantId ? 'Click to rename' : undefined}
                              >
                                {proposal.title}
                              </p>
                            )}
                            <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                              {nameOf(proposal.createdBy)}
                              {voteEntries.length > 0 && ` · ${voteEntries.length} response${voteEntries.length !== 1 ? 's' : ''}`}
                            </p>
                            {voteEntries.length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                {voteEntries.map(([pid, vote]) => (
                                  <span key={pid} className="text-xs" style={{ color: 'var(--muted)' }}>
                                    {nameOf(pid)}: {formatVoteCells(vote)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setHiddenProposalIds(prev => {
                                const next = new Set(prev);
                                if (next.has(proposal.id)) next.delete(proposal.id); else next.add(proposal.id);
                                return next;
                              })}
                              style={{ opacity: hiddenProposalIds.has(proposal.id) ? 0.4 : 1 }}
                            >
                              {hiddenProposalIds.has(proposal.id) ? 'Hidden' : 'Visible'}
                            </button>
                            {myParticipantId && (
                              <button
                                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveProposalId(isActive ? null : proposal.id)}
                              >
                                {myVote && myVote.length > 0 ? 'Change' : 'Pick time'}
                              </button>
                            )}
                            {myParticipantId && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); dismissProposal(proposal.id); }}
                                title="Dismiss meetup"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Title modal for new proposal */}
      {showTitleModal && (
        <div className="modal-overlay" onClick={() => setShowTitleModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              Suggest a meetup
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--subtle)' }}>
              Name your meetup, then select your available time on the calendar.
            </p>
            <label className="label">Meetup name</label>
            <input
              className="input mb-4"
              type="text"
              placeholder="e.g. Team lunch"
              maxLength={100}
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && proposalTitle.trim()) createProposal(); }}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                disabled={proposalLoading || !proposalTitle.trim()}
                onClick={createProposal}
              >
                {proposalLoading ? 'Creating…' : 'Next'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowTitleModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
