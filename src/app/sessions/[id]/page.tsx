'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import type { BusyBlock, Proposal } from '@/types';
import { participantName, participantColor } from '@/lib/participant-names';

interface Participant {
  id: string;
  blocks: BusyBlock[];
}

const EMPTY_BLOCKS: BusyBlock[] = [];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { state, dispatch } = useApp();
  const [sessionId, setSessionId] = useState<string>('');
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

  useEffect(() => {
    params.then((p) => setSessionId(p.id));
  }, [params]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setGroupName(data.name ?? null);
    setParticipants(data.participants);
    setQuorum(data.quorum);
    setPersonalSessionMap(data.personalSessionMap ?? {});
    setProposals(data.proposals ?? []);
    setLoading(false);
  }, [sessionId]);

  const myParticipantId = useMemo(() => {
    if (!state.sessionId) return undefined;
    for (const [pid, psid] of Object.entries(personalSessionMap)) {
      if (psid === state.sessionId) return pid;
    }
    return undefined;
  }, [state.sessionId, personalSessionMap]);

  useEffect(() => {
    if (!sessionId) return;
    fetchSession();
    const interval = setInterval(fetchSession, 10_000);
    return () => clearInterval(interval);
  }, [sessionId, fetchSession]);

  const joinLink = typeof window !== 'undefined' && sessionId
    ? `${window.location.origin}/sessions/${sessionId}/join`
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
      const res = await fetch(`/api/sessions/${sessionId}/proposals`, {
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
    await fetch(`/api/sessions/${sessionId}/proposals/${activeProposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId, cells }),
    });
    await fetchSession();
  }

  async function handleJoinGroup() {
    if (!sessionId) return;
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
      const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantToken: sessionId, personalSessionId: personalId }),
      });
      const joinData = await joinRes.json().catch(() => ({}));
      if (!joinRes.ok) {
        throw new Error((joinData as { error?: string }).error ?? 'Failed to join group.');
      }

      const { participantId } = joinData as { participantId: string };
      dispatch({
        type: 'ADD_GROUP',
        group: {
          sessionId,
          role: 'participant',
          participantId,
          name: groupName || `Group ${sessionId}`,
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
    await fetch(`/api/sessions/${sessionId}/proposals/${proposalId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId }),
    });
    if (activeProposalId === proposalId) setActiveProposalId(null);
    await fetchSession();
  }

  function formatVoteCells(cells: string[]): string {
    if (!Array.isArray(cells) || cells.length === 0) return '—';
    // Group cells by date, show condensed ranges
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
      // Small delay to let grid render with updated proposals
      const t = setTimeout(() => highlightProposal(activeProposalId), 50);
      return () => clearTimeout(t);
    } else {
      clearHighlight();
    }
  }, [activeProposalId, highlightProposal, clearHighlight]);

  const activeProposal = proposals.find(p => p.id === activeProposalId) ?? null;
  const suggestMode = !!activeProposalId;

  // Pre-populate suggest cells from existing vote when entering suggest mode
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
        <Link href="/availability" className="back-link">&larr; Back</Link>

        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{groupName || `Group ${sessionId}`}</h1>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                style={{ color: copied ? 'var(--success)' : 'var(--subtle)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                title="Copy invite link"
              >
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                )}
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
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: state.userColor || participantColor(myParticipantId) }}
                  />
                  {state.displayName || participantName(myParticipantId)}
                </span>
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
                        onMouseEnter={() => !isActive && highlightProposal(proposal.id)}
                        onMouseLeave={() => !isActive && clearHighlight()}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {proposal.title}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                              {participantName(proposal.createdBy)}
                              {voteEntries.length > 0 && ` · ${voteEntries.length} response${voteEntries.length !== 1 ? 's' : ''}`}
                            </p>
                            {voteEntries.length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                {voteEntries.map(([pid, vote]) => (
                                  <span key={pid} className="text-xs" style={{ color: 'var(--muted)' }}>
                                    {participantName(pid)}: {formatVoteCells(vote)}
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
                            {isCreator && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => dismissProposal(proposal.id)}
                                title="Dismiss proposal"
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
