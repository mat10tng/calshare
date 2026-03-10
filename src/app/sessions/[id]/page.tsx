'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import type { BusyBlock, Proposal } from '@/types';
import type { SuggestSelection } from '@/components/AvailabilityGrid';

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
          </>
        )}
      </main>
    </>
  );
}
