'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import type { BusyBlock, Proposal } from '@/types';
import type { SuggestSelection } from '@/components/AvailabilityGrid';
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
  const [suggestMode, setSuggestMode] = useState(false);
  const [suggestSelection, setSuggestSelection] = useState<SuggestSelection | null>(null);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    params.then((p) => setSessionId(p.id));
  }, [params]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setParticipants(data.participants);
    setQuorum(data.quorum);
    setPersonalSessionMap(data.personalSessionMap ?? {});
    setProposals(data.proposals ?? []);
    setLoading(false);
  }, [sessionId]);

  // Find my participant ID by matching my personal session ID
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

  async function submitProposal() {
    if (!suggestSelection || !proposalTitle.trim() || !myParticipantId) return;
    setProposalLoading(true);
    try {
      const startH = String(suggestSelection.startHour).padStart(2, '0');
      const endH = String(suggestSelection.endHour).padStart(2, '0');
      const start = `${suggestSelection.startDate}T${startH}:00:00.000Z`;
      const end = `${suggestSelection.endDate}T${endH}:00:00.000Z`;
      await fetch(`/api/sessions/${sessionId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: proposalTitle.trim(), start, end, participantId: myParticipantId }),
      });
      await fetchSession();
      setSuggestSelection(null);
      setProposalTitle('');
      setSuggestMode(false);
    } finally {
      setProposalLoading(false);
    }
  }

  const now = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + state.preferences.lookAheadDays * 86_400_000)
    .toISOString().split('T')[0];

  // Hours displayed in the grid (must match AvailabilityGrid HOURS)
  const GRID_HOURS = useMemo(() => Array.from({ length: 17 }, (_, i) => i + 6), []);

  function formatProposalRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const time = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const sDay = s.toISOString().split('T')[0];
    const eDay = e.toISOString().split('T')[0];
    if (sDay === eDay) {
      return `${weekday(s)} ${time(s)}\u2009\u2013\u2009${time(e)}`;
    }
    return `${weekday(s)} ${time(s)}\u2009\u2013\u2009${weekday(e)} ${time(e)}`;
  }

  async function voteOnProposal(proposalId: string, vote: boolean) {
    if (!myParticipantId) return;
    await fetch(`/api/sessions/${sessionId}/proposals/${proposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId, vote }),
    });
    await fetchSession();
  }

  async function dismissProposal(proposalId: string) {
    if (!myParticipantId) return;
    await fetch(`/api/sessions/${sessionId}/proposals/${proposalId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: myParticipantId }),
    });
    await fetchSession();
  }

  // Compute grid dates for hover highlighting
  const gridDates = useMemo(() => {
    const dates: string[] = [];
    const cur = new Date(now + 'T00:00:00.000Z');
    const end = new Date(until + 'T00:00:00.000Z');
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }, [now, until]);

  function highlightProposalCells(proposal: Proposal) {
    const table = document.querySelector<HTMLTableElement>('.avail-grid');
    if (!table) return;
    const start = new Date(proposal.start);
    const end = new Date(proposal.end);
    const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
    rows.forEach((row, ri) => {
      const hour = GRID_HOURS[ri];
      if (hour === undefined) return;
      const cells = row.querySelectorAll<HTMLTableCellElement>('td.grid-cell');
      cells.forEach((cell, ci) => {
        const date = gridDates[ci];
        if (!date) return;
        const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
        const slotEnd = new Date(slotStart.getTime() + 3_600_000);
        if (start < slotEnd && end > slotStart) {
          cell.classList.add('grid-cell-proposal--highlighted');
        }
      });
    });
  }

  function clearProposalHighlight() {
    const table = document.querySelector<HTMLTableElement>('.avail-grid');
    if (!table) return;
    table.querySelectorAll('.grid-cell-proposal--highlighted').forEach((cell) => {
      cell.classList.remove('grid-cell-proposal--highlighted');
    });
  }


  return (
    <>
      <Nav />
      <main className="page-container">
        <Link href="/availability" className="back-link">&larr; Back</Link>

        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="page-title mb-1">Group Session</h1>
            <p className="page-subtitle">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
              {quorum > 1 ? ` · showing slots where ≥${quorum} are free` : ''}
            </p>
          </div>
          {myParticipantId && (
            <button
              className={`btn ${suggestMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSuggestMode(!suggestMode); setSuggestSelection(null); setProposalTitle(''); }}
            >
              Suggest a time
            </button>
          )}
        </div>

        {/* Invite link */}
        <div className="card--surface rounded-xl p-4 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            Invite link — share this with your group
          </p>
          <div className="flex gap-2 items-stretch">
            <code
              className="flex-1 text-xs rounded-lg px-3 py-2.5 break-all self-center font-mono"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {joinLink || '…'}
            </code>
            <button onClick={copyLink} className="btn btn-secondary whitespace-nowrap" style={{ minHeight: 44 }}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Loading participant availability…</p>
        ) : (
          <>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
              {participants.length === 0
                ? 'No participants yet — share the invite link above'
                : 'Group availability'}
            </h2>
            <AvailabilityGrid
              blocks={EMPTY_BLOCKS}
              fromDate={now}
              toDate={until}
              participants={participants}
              editableParticipantId={myParticipantId}
              onBlocksChange={myParticipantId ? (newBlocks) => {
                dispatch({ type: 'SET_BLOCKS', blocks: newBlocks });
              } : undefined}
              suggestMode={suggestMode}
              onSuggestSelect={suggestMode ? (sel) => setSuggestSelection(sel) : undefined}
              proposals={proposals}
            />
            {suggestSelection && (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <input
                  className="input"
                  style={{ maxWidth: 260 }}
                  type="text"
                  placeholder="e.g. Team lunch"
                  maxLength={100}
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={proposalLoading || !proposalTitle.trim()}
                  onClick={submitProposal}
                >
                  {proposalLoading ? 'Proposing…' : 'Propose'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setSuggestSelection(null); setSuggestMode(false); setProposalTitle(''); }}
                >
                  Cancel
                </button>
              </div>
            )}

            {proposals.length > 0 && (
              <>
                <h2 className="text-sm font-semibold mb-3 mt-8" style={{ color: 'var(--foreground)' }}>Proposals</h2>
                <div className="flex flex-col gap-3">
                  {proposals.map((proposal) => {
                    const votes = Object.values(proposal.votes);
                    const yesCount = votes.filter(Boolean).length;
                    const noCount = votes.filter((v) => !v).length;
                    const myVote = myParticipantId ? proposal.votes[myParticipantId] : undefined;
                    const isCreator = myParticipantId === proposal.createdBy;

                    return (
                      <div
                        key={proposal.id}
                        className="card"
                        onMouseEnter={() => highlightProposalCells(proposal)}
                        onMouseLeave={clearProposalHighlight}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {proposal.title}
                              <span className="font-normal" style={{ color: 'var(--subtle)' }}>
                                {' \u2014 '}{formatProposalRange(proposal.start, proposal.end)}
                              </span>
                            </p>
                            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ background: participantColor(proposal.createdBy) }}
                              />
                              {participantName(proposal.createdBy)}
                              <span style={{ color: 'var(--subtle)' }}>&middot;</span>
                              <span>{yesCount} yes &middot; {noCount} no</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {myParticipantId && (
                              <>
                                <button
                                  className={`btn btn-sm ${myVote === true ? 'btn-primary' : 'btn-ghost'}`}
                                  onClick={() => voteOnProposal(proposal.id, true)}
                                >
                                  Yes
                                </button>
                                <button
                                  className={`btn btn-sm ${myVote === false ? 'btn-primary' : 'btn-ghost'}`}
                                  onClick={() => voteOnProposal(proposal.id, false)}
                                >
                                  No
                                </button>
                              </>
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
    </>
  );
}
