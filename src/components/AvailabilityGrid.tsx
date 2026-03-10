'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { participantColor, participantName } from '@/lib/participant-names';
import type { BusyBlock, Proposal } from '@/types';

export interface GridParticipant {
  id: string;
  blocks: BusyBlock[];
}

interface Props {
  blocks: BusyBlock[];
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  onBlocksChange?: (blocks: BusyBlock[]) => void;
  participants?: GridParticipant[]; // group mode: per-user colored cells
  editableParticipantId?: string;   // group mode: which participant's cells are editable
  busyColor?: string;               // override busy cell color in personal mode
  suggestMode?: boolean;
  initialSuggestCells?: string[];   // cells to preselect when entering suggest mode
  onSuggestCellsChange?: (cells: string[]) => void;
  proposals?: Proposal[];
}

interface DragState {
  startRow: number;
  startCol: number;
  currentRow: number;
  currentCol: number;
  mode: boolean; // true = set busy, false = set free
}

function getDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + 'T00:00:00.000Z');
  const end = new Date(to + 'T00:00:00.000Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// Hours to display: 06:00–22:00
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

// Build a Set of "date:hour" keys that are busy — O(blocks) once instead of O(blocks) per cell
function buildBusySet(blocks: BusyBlock[], dates: string[]): Set<string> {
  const set = new Set<string>();
  const dateSet = new Set(dates);
  for (const b of blocks) {
    if (!b.busy) continue;
    const start = new Date(b.start);
    const end = new Date(b.end);
    // Walk each hour the block overlaps
    const date = b.start.split('T')[0];
    if (!dateSet.has(date)) {
      // Block might span multiple dates — check each hour
      for (const d of dates) {
        for (const h of HOURS) {
          const slotStart = new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`);
          const slotEnd = new Date(slotStart.getTime() + 3_600_000);
          if (start < slotEnd && end > slotStart) set.add(`${d}:${h}`);
        }
      }
    } else {
      for (const h of HOURS) {
        const slotStart = new Date(`${date}T${String(h).padStart(2, '0')}:00:00.000Z`);
        const slotEnd = new Date(slotStart.getTime() + 3_600_000);
        if (start < slotEnd && end > slotStart) set.add(`${date}:${h}`);
      }
    }
  }
  return set;
}

// Rebuild blocks array from overrides applied on top of original busy set.
function gridToBlocks(
  dates: string[],
  overrides: Map<string, boolean>,
  original: BusyBlock[],
  busySet: Set<string>,
): BusyBlock[] {
  const dateSet = new Set(dates);
  const minHour = HOURS[0];
  const maxHourEnd = HOURS[HOURS.length - 1] + 1;

  const preserved = original.filter((b) => {
    if (!b.busy) return false;
    const date = b.start.split('T')[0];
    if (!dateSet.has(date)) return true;
    const hour = new Date(b.start).getUTCHours();
    return hour < minHour || hour >= maxHourEnd;
  });

  const inView: BusyBlock[] = [];
  for (const date of dates) {
    for (const hour of HOURS) {
      const key = `${date}:${hour}`;
      const busy = overrides.has(key) ? overrides.get(key)! : busySet.has(key);
      if (busy) {
        const h = String(hour).padStart(2, '0');
        const h1 = String(hour + 1).padStart(2, '0');
        inView.push({ start: `${date}T${h}:00:00.000Z`, end: `${date}T${h1}:00:00.000Z`, busy: true, allDay: false });
      }
    }
  }

  return [...preserved, ...inView];
}

interface CellInfo {
  colors: string[];
  pids: string[];
}

// Build per-cell map of participant colors + IDs for group mode
function buildParticipantCellMap(
  participants: GridParticipant[],
  dates: string[],
): Map<string, CellInfo> {
  const map = new Map<string, CellInfo>();
  const dateSet = new Set(dates);
  for (const p of participants) {
    const color = participantColor(p.id);
    for (const b of p.blocks) {
      if (!b.busy) continue;
      const start = new Date(b.start);
      const end = new Date(b.end);
      const date = b.start.split('T')[0];
      const datesToCheck = dateSet.has(date) ? [date] : dates;
      for (const d of datesToCheck) {
        for (const h of HOURS) {
          const slotStart = new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`);
          const slotEnd = new Date(slotStart.getTime() + 3_600_000);
          if (start < slotEnd && end > slotStart) {
            const key = `${d}:${h}`;
            const existing = map.get(key);
            if (existing) {
              if (!existing.pids.includes(p.id)) {
                existing.pids.push(p.id);
                existing.colors.push(color);
              }
            } else {
              map.set(key, { colors: [color], pids: [p.id] });
            }
          }
        }
      }
    }
  }
  return map;
}

// Build CSS background for a cell with one or more participant colors
function cellBackground(colors: string[]): string {
  if (colors.length === 1) return colors[0];
  // Equal-width vertical columns sharing horizontal space
  const pct = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * pct}% ${(i + 1) * pct}%`).join(', ');
  return `linear-gradient(to right, ${stops})`;
}

export function AvailabilityGrid({ blocks, fromDate, toDate, onBlocksChange, participants, editableParticipantId, busyColor, suggestMode, initialSuggestCells, onSuggestCellsChange, proposals }: Props) {
  const dates = useMemo(() => getDates(fromDate, toDate), [fromDate, toDate]);

  // Pre-compute busy lookup — O(blocks) once, O(1) per cell
  const busySet = useMemo(() => buildBusySet(blocks, dates), [blocks, dates]);

  // Group mode: editable participant's blocks as a separate busy set
  const myParticipant = useMemo(
    () => editableParticipantId ? participants?.find(p => p.id === editableParticipantId) : null,
    [editableParticipantId, participants],
  );
  const myBusySet = useMemo(
    () => myParticipant ? buildBusySet(myParticipant.blocks, dates) : null,
    [myParticipant, dates],
  );
  const myBlocks = useMemo(() => myParticipant?.blocks ?? [], [myParticipant]);
  const myColor = useMemo(
    () => editableParticipantId ? participantColor(editableParticipantId) : '',
    [editableParticipantId],
  );

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hiddenPids, setHiddenPids] = useState<Set<string>>(new Set());

  // Suggest mode: set of selected cell keys, toggle on click/drag just like normal editing
  const [suggestCells, setSuggestCells] = useState<Set<string>>(new Set());
  const [suggestDrag, setSuggestDrag] = useState<DragState | null>(null);

  // Initialize suggestCells when entering suggest mode
  const prevSuggestModeRef = useRef(false);
  useEffect(() => {
    if (suggestMode && !prevSuggestModeRef.current) {
      setSuggestCells(new Set(initialSuggestCells ?? []));
    }
    if (!suggestMode && prevSuggestModeRef.current) {
      setSuggestCells(new Set());
    }
    prevSuggestModeRef.current = !!suggestMode;
  }, [suggestMode, initialSuggestCells]);

  // Build map of "date:hour" → voter colors and proposal IDs for calendar cells
  const { proposalCellMap, proposalIdMap } = useMemo(() => {
    const colorMap = new Map<string, string[]>();
    const idMap = new Map<string, string[]>();
    if (!proposals) return { proposalCellMap: colorMap, proposalIdMap: idMap };

    function addColor(key: string, color: string) {
      const existing = colorMap.get(key);
      if (existing) { if (!existing.includes(color)) existing.push(color); }
      else colorMap.set(key, [color]);
    }
    function addId(key: string, id: string) {
      const existing = idMap.get(key);
      if (existing) { if (!existing.includes(id)) existing.push(id); }
      else idMap.set(key, [id]);
    }

    for (const p of proposals) {
      for (const [pid, cells] of Object.entries(p.votes)) {
        if (!Array.isArray(cells)) continue;
        const color = participantColor(pid);
        for (const cellKey of cells) {
          addColor(cellKey, color);
          addId(cellKey, p.id);
        }
      }
    }
    return { proposalCellMap: colorMap, proposalIdMap: idMap };
  }, [proposals, dates]);

  // Group mode: per-cell color map (excludes editable participant if editing, and hidden participants)
  const visibleParticipants = useMemo(
    () => {
      if (!participants) return null;
      let list = participants;
      if (editableParticipantId) list = list.filter(p => p.id !== editableParticipantId);
      if (hiddenPids.size > 0) list = list.filter(p => !hiddenPids.has(p.id));
      return list;
    },
    [editableParticipantId, participants, hiddenPids],
  );
  const cellColorMap = useMemo(
    () => participants ? buildParticipantCellMap(visibleParticipants ?? participants, dates) : null,
    [visibleParticipants, participants, dates],
  );

  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const datesRef = useRef(dates);
  datesRef.current = dates;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const busySetRef = useRef(busySet);
  busySetRef.current = busySet;
  const onBlocksChangeRef = useRef(onBlocksChange);
  onBlocksChangeRef.current = onBlocksChange;
  const myBusySetRef = useRef(myBusySet);
  myBusySetRef.current = myBusySet;
  const myBlocksRef = useRef(myBlocks);
  myBlocksRef.current = myBlocks;
  const suggestDragRef = useRef(suggestDrag);
  suggestDragRef.current = suggestDrag;
  const suggestCellsRef = useRef(suggestCells);
  suggestCellsRef.current = suggestCells;
  const onSuggestCellsChangeRef = useRef(onSuggestCellsChange);
  onSuggestCellsChangeRef.current = onSuggestCellsChange;
  const cellColorMapRef = useRef(cellColorMap);
  cellColorMapRef.current = cellColorMap;
  const proposalIdMapRef = useRef(proposalIdMap);
  proposalIdMapRef.current = proposalIdMap;
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const editableParticipantIdRef = useRef(editableParticipantId);
  editableParticipantIdRef.current = editableParticipantId;

  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    setOverrides(new Map());
  }, [blocks, myBlocks]);

  const commitDrag = useCallback((d: DragState) => {
    const minRow = Math.min(d.startRow, d.currentRow);
    const maxRow = Math.max(d.startRow, d.currentRow);
    const minCol = Math.min(d.startCol, d.currentCol);
    const maxCol = Math.max(d.startCol, d.currentCol);

    const next = new Map(overridesRef.current);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        next.set(`${datesRef.current[c]}:${HOURS[r]}`, d.mode);
      }
    }
    setOverrides(next);
    // In group edit mode, rebuild from editable participant's blocks/busySet
    const srcBlocks = myBusySetRef.current ? myBlocksRef.current : blocksRef.current;
    const srcBusySet = myBusySetRef.current ?? busySetRef.current;
    onBlocksChangeRef.current?.(gridToBlocks(datesRef.current, next, srcBlocks, srcBusySet));
  }, []);

  useEffect(() => {
    function onMouseUp() {
      const d = dragRef.current;
      if (d) {
        commitDrag(d);
        setDrag(null);
      }
      const sd = suggestDragRef.current;
      if (sd) {
        const minRow = Math.min(sd.startRow, sd.currentRow);
        const maxRow = Math.max(sd.startRow, sd.currentRow);
        const minCol = Math.min(sd.startCol, sd.currentCol);
        const maxCol = Math.max(sd.startCol, sd.currentCol);
        const next = new Set(suggestCellsRef.current);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const key = `${datesRef.current[c]}:${HOURS[r]}`;
            if (sd.mode) next.add(key); else next.delete(key);
          }
        }
        setSuggestCells(next);
        onSuggestCellsChangeRef.current?.([...next]);
        setSuggestDrag(null);
      }
    }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [commitDrag]);

  // During drag, check if cell is in the drag rectangle
  function inDragRect(row: number, col: number): boolean {
    if (!drag) return false;
    return (
      row >= Math.min(drag.startRow, drag.currentRow) &&
      row <= Math.max(drag.startRow, drag.currentRow) &&
      col >= Math.min(drag.startCol, drag.currentCol) &&
      col <= Math.max(drag.startCol, drag.currentCol)
    );
  }

  function isSuggestHighlighted(key: string, row: number, col: number): boolean {
    // During active drag, preview the toggle result
    if (suggestDrag) {
      const inRect =
        row >= Math.min(suggestDrag.startRow, suggestDrag.currentRow) &&
        row <= Math.max(suggestDrag.startRow, suggestDrag.currentRow) &&
        col >= Math.min(suggestDrag.startCol, suggestDrag.currentCol) &&
        col <= Math.max(suggestDrag.startCol, suggestDrag.currentCol);
      if (inRect) return suggestDrag.mode;
    }
    return suggestCells.has(key);
  }

  // Only used during drag — determines cell class when dragging
  function dragCellClass(row: number, col: number): string {
    if (inDragRect(row, col)) {
      return drag!.mode ? 'grid-cell grid-cell-drag-busy' : 'grid-cell grid-cell-drag-free';
    }
    const key = `${dates[col]}:${HOURS[row]}`;
    const busy = overrides.has(key) ? overrides.get(key)! : busySet.has(key);
    return busy ? 'grid-cell grid-cell-busy' : 'grid-cell';
  }

  // Static cell class — no hover logic, CSS handles hover
  function staticCellClass(col: number, row: number): string {
    const key = `${dates[col]}:${HOURS[row]}`;
    const busy = overrides.has(key) ? overrides.get(key)! : busySet.has(key);
    return busy ? 'grid-cell grid-cell-busy' : 'grid-cell';
  }

  function handleCellMouseDown(row: number, col: number) {
    const key = `${dates[col]}:${HOURS[row]}`;
    // In group edit mode, check my busy set; otherwise use the flat busySet
    const srcBusy = myBusySet ?? busySet;
    const busy = overrides.has(key) ? overrides.get(key)! : srcBusy.has(key);
    setDrag({ startRow: row, startCol: col, currentRow: row, currentCol: col, mode: !busy });
  }

  // Lightweight vertical column line — DOM-direct, no React state
  const colLineRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    const line = colLineRef.current;
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!table || !line || !wrapper || !tooltip) return;

    let activeHeader: HTMLElement | null = null;
    const headers = table.querySelectorAll<HTMLElement>('.avail-grid__col-header');
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTd: HTMLTableCellElement | null = null;

    function showTooltip(td: HTMLTableCellElement) {
      const row = td.closest('tr');
      if (!row) return;
      const ri = Array.from(row.parentElement!.children).indexOf(row);
      const ci = td.cellIndex - 1;
      const dates = datesRef.current;
      if (ci < 0 || ci >= dates.length || ri < 0 || ri >= HOURS.length) return;

      const date = dates[ci];
      const hour = HOURS[ri];
      const key = `${date}:${hour}`;
      const h0 = String(hour).padStart(2, '0');
      const h1 = String(hour + 1).padStart(2, '0');
      const dayLabel = new Date(date + 'T00:00:00.000Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

      const lines: string[] = [`${dayLabel}, ${h0}:00–${h1}:00`];

      // Who's busy
      const ccm = cellColorMapRef.current;
      if (ccm) {
        const info = ccm.get(key);
        const editPid = editableParticipantIdRef.current;
        const myBusy = editPid && myBusySetRef.current ? myBusySetRef.current.has(key) : false;
        const busyNames: string[] = [];
        if (info) info.pids.forEach(pid => busyNames.push(participantName(pid)));
        if (myBusy && editPid && !busyNames.some((_, i) => info?.pids[i] === editPid)) {
          busyNames.push(participantName(editPid));
        }
        const totalParticipants = participantsRef.current?.length ?? 0;
        const freeCount = totalParticipants - busyNames.length;
        if (busyNames.length > 0) {
          lines.push(`Busy: ${busyNames.join(', ')}`);
        }
        if (freeCount > 0) {
          lines.push(`${freeCount} free`);
        }
      } else {
        // Personal mode
        const busy = busySetRef.current.has(key);
        lines.push(busy ? 'Busy' : 'Free');
      }

      // Proposals
      const pIds = proposalIdMapRef.current.get(key);
      if (pIds && proposalsRef.current) {
        const names = pIds
          .map(id => proposalsRef.current!.find(p => p.id === id)?.title)
          .filter(Boolean);
        if (names.length > 0) lines.push(`Meetups: ${names.join(', ')}`);
      }

      tooltip!.textContent = lines.join(' · ');

      const wrapperRect = wrapper!.getBoundingClientRect();
      const tdRect = td.getBoundingClientRect();
      tooltip!.style.opacity = '1';
      tooltip!.style.left = `${tdRect.left - wrapperRect.left + tdRect.width / 2}px`;
      tooltip!.style.top = `${tdRect.top - wrapperRect.top - 4}px`;
    }

    function hideTooltip() {
      if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
      tooltip!.style.opacity = '0';
      lastTd = null;
    }

    function onMove(e: MouseEvent) {
      if (dragRef.current) { line!.style.opacity = '0'; clearHeader(); hideTooltip(); return; }
      const td = (e.target as HTMLElement).closest('.grid-cell') as HTMLTableCellElement | null;
      if (!td) { line!.style.opacity = '0'; clearHeader(); hideTooltip(); return; }

      // Column line
      const wrapperRect = wrapper!.getBoundingClientRect();
      const tdRect = td.getBoundingClientRect();
      const thead = table!.querySelector('thead');
      const headerH = thead ? thead.getBoundingClientRect().height : 0;
      line!.style.opacity = '1';
      line!.style.left = `${tdRect.left - wrapperRect.left + tdRect.width / 2}px`;
      line!.style.top = `${headerH}px`;
      line!.style.height = `${wrapper!.scrollHeight - headerH}px`;

      // Highlight column header
      const colIndex = td.cellIndex - 1; // subtract 1 for the time label column
      if (colIndex >= 0 && colIndex < headers.length) {
        if (activeHeader && activeHeader !== headers[colIndex]) {
          activeHeader.classList.remove('avail-grid__col-header--active');
        }
        activeHeader = headers[colIndex];
        activeHeader.classList.add('avail-grid__col-header--active');
      }

      // Tooltip with 500ms delay
      if (td !== lastTd) {
        hideTooltip();
        lastTd = td;
        tooltipTimer = setTimeout(() => showTooltip(td), 500);
      }
    }

    function clearHeader() {
      if (activeHeader) {
        activeHeader.classList.remove('avail-grid__col-header--active');
        activeHeader = null;
      }
    }

    function onLeave() {
      line!.style.opacity = '0';
      clearHeader();
      hideTooltip();
    }

    table.addEventListener('mousemove', onMove);
    table.addEventListener('mouseleave', onLeave);
    return () => {
      table.removeEventListener('mousemove', onMove);
      table.removeEventListener('mouseleave', onLeave);
      if (tooltipTimer) clearTimeout(tooltipTimer);
    };
  }, []);

  return (
    <div className="overflow-x-auto avail-grid-wrapper">
      <div ref={wrapperRef} className="relative inline-block min-w-full">
        {/* Vertical column indicator line — positioned via mousemove, no React re-render */}
        <div
          ref={colLineRef}
          className="avail-grid__col-line"
        />
        {/* Cell tooltip — positioned via mousemove with 500ms delay */}
        <div
          ref={tooltipRef}
          className="avail-grid__tooltip"
        />
        <table
          ref={tableRef}
          className={`avail-grid text-xs border-separate min-w-full ${drag || suggestDrag ? 'select-none avail-grid--dragging' : ''} ${suggestMode ? 'avail-grid--suggest' : ''}`}
          style={{ borderSpacing: 2 }}
        >
          <thead>
            <tr>
              <th className="avail-grid__time-header w-12 text-right pr-2 font-normal" />
              {dates.map((d) => {
                const day = new Date(d + 'T00:00:00.000Z');
                const weekday = day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                return (
                  <th key={d} className="avail-grid__col-header px-1 py-1 font-medium min-w-[36px] text-center">
                    <span style={{ color: isWeekend ? 'var(--accent)' : undefined }}>{weekday}</span>
                    <br />
                    {d.slice(5)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour, ri) => (
              <tr key={hour} className="avail-grid__row">
                <td className="avail-grid__time-label text-right pr-2 py-0 leading-none font-mono">
                  {String(hour).padStart(2, '0')}:00
                </td>
                {dates.map((_, ci) => {
                  const key = `${dates[ci]}:${HOURS[ri]}`;
                  const hasSuggestHighlight = suggestMode && isSuggestHighlighted(key, ri, ci);
                  const proposalColors = proposalCellMap.get(key);
                  const proposalIds = proposalIdMap.get(key);
                  const hasProposalDot = !!proposalColors;
                  const needsRelative = hasProposalDot;

                  // Suggest mode mouse handlers — toggle cells like normal editing
                  const suggestMouseDown = suggestMode ? () => {
                    const isSelected = suggestCells.has(key);
                    setSuggestDrag({ startRow: ri, startCol: ci, currentRow: ri, currentCol: ci, mode: !isSelected });
                  } : undefined;
                  const suggestMouseEnter = suggestDrag ? () => {
                    setSuggestDrag((prev) => prev ? { ...prev, currentRow: ri, currentCol: ci } : null);
                  } : undefined;

                  // Group mode with editing: interactive cells with combined colors
                  if (cellColorMap && myBusySet) {
                    const othersInfo = cellColorMap.get(key);
                    const myBusy = overrides.has(key) ? overrides.get(key)! : myBusySet.has(key);
                    const inRect = drag ? inDragRect(ri, ci) : false;
                    const showMyBusy = inRect ? drag!.mode : myBusy;

                    const colors: string[] = othersInfo ? [...othersInfo.colors] : [];
                    const pids: string[] = othersInfo ? [...othersInfo.pids] : [];
                    if (showMyBusy && !hiddenPids.has(editableParticipantId!)) {
                      colors.push(myColor);
                      pids.push(editableParticipantId!);
                    }

                    const hasColors = colors.length > 0;
                    const cls = [
                      hasColors ? 'grid-cell grid-cell-group' : 'grid-cell',
                      hasSuggestHighlight ? 'grid-cell-suggest' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <td
                        key={ci}
                        className={cls}
                        style={{
                          ...(hasColors ? { background: cellBackground(colors), borderColor: 'transparent' } : undefined),
                          ...(needsRelative ? { position: 'relative' as const } : undefined),
                          ...(suggestMode ? { cursor: 'pointer' } : undefined),
                        }}
                        data-pids={hasColors ? pids.join(' ') : undefined}
                        data-proposals={proposalIds ? proposalIds.join(' ') : undefined}
                        onMouseDown={suggestMode ? suggestMouseDown : () => handleCellMouseDown(ri, ci)}
                        onMouseEnter={suggestDrag ? suggestMouseEnter : (drag ? () => setDrag((prev) => prev ? { ...prev, currentRow: ri, currentCol: ci } : null) : undefined)}
                      >
                        {hasProposalDot && proposalColors!.map((c, i) => (
                          <div key={i} className="grid-cell-proposal-dot" style={{ background: c, right: 2 + i * 5 }} />
                        ))}
                      </td>
                    );
                  }

                  // Group mode: read-only colored cells
                  if (cellColorMap && !drag) {
                    const info = cellColorMap.get(key);
                    const cls = [
                      info ? 'grid-cell grid-cell-group' : 'grid-cell',
                      hasSuggestHighlight ? 'grid-cell-suggest' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <td
                        key={ci}
                        className={cls}
                        style={{
                          ...(info ? { background: cellBackground(info.colors), borderColor: 'transparent' } : undefined),
                          ...(needsRelative ? { position: 'relative' as const } : undefined),
                          ...(suggestMode ? { cursor: 'pointer' } : undefined),
                        }}
                        data-pids={info ? info.pids.join(' ') : undefined}
                        data-proposals={proposalIds ? proposalIds.join(' ') : undefined}
                        onMouseDown={suggestMouseDown}
                        onMouseEnter={suggestMouseEnter}
                      >
                        {hasProposalDot && proposalColors!.map((c, i) => (
                          <div key={i} className="grid-cell-proposal-dot" style={{ background: c, right: 2 + i * 5 }} />
                        ))}
                      </td>
                    );
                  }

                  // Personal mode: drag to edit
                  const baseCls = drag ? dragCellClass(ri, ci) : staticCellClass(ci, ri);
                  const isBusy = baseCls.includes('busy');
                  const cls = [
                    busyColor && isBusy ? 'grid-cell grid-cell-group' : baseCls,
                    hasSuggestHighlight ? 'grid-cell-suggest' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <td
                      key={ci}
                      className={cls}
                      style={{
                        ...(busyColor && isBusy ? { background: busyColor, borderColor: 'transparent' } : undefined),
                        ...(needsRelative ? { position: 'relative' as const } : undefined),
                        ...(suggestMode ? { cursor: 'pointer' } : undefined),
                      }}
                      data-proposals={proposalIds ? proposalIds.join(' ') : undefined}
                      onMouseDown={suggestMode ? suggestMouseDown : () => handleCellMouseDown(ri, ci)}
                      onMouseEnter={suggestDrag ? suggestMouseEnter : (drag ? () => setDrag((prev) => prev ? { ...prev, currentRow: ri, currentCol: ci } : null) : undefined)}
                    >
                      {hasProposalDot && proposalColors!.map((c, i) => (
                          <div key={i} className="grid-cell-proposal-dot" style={{ background: c, right: 2 + i * 5 }} />
                        ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: 'var(--subtle)' }}>
        {participants ? (
          <>
            {participants.map((p) => {
              const hidden = hiddenPids.has(p.id);
              return (
                <span
                  key={p.id}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  style={{ opacity: hidden ? 0.35 : 1, textDecoration: hidden ? 'line-through' : undefined }}
                  onClick={() => {
                    setHiddenPids(prev => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  onMouseEnter={() => {
                    if (hidden) return;
                    const table = tableRef.current;
                    if (!table) return;
                    table.querySelectorAll<HTMLElement>('.grid-cell-group').forEach((cell) => {
                      const pids = cell.dataset.pids ?? '';
                      if (!pids.includes(p.id)) {
                        cell.classList.add('grid-cell-group--dimmed');
                      } else {
                        cell.classList.add('grid-cell-group--highlighted');
                      }
                    });
                  }}
                  onMouseLeave={() => {
                    const table = tableRef.current;
                    if (!table) return;
                    table.querySelectorAll<HTMLElement>('.grid-cell-group').forEach((cell) => {
                      cell.classList.remove('grid-cell-group--dimmed', 'grid-cell-group--highlighted');
                    });
                  }}
                >
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: participantColor(p.id) }} />
                  {participantName(p.id)}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--slot-free)', border: '1px solid var(--border)' }} /> Free
            </span>
            {editableParticipantId && onBlocksChange && (
              <span className="ml-auto italic">Drag to edit your availability</span>
            )}
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: busyColor || 'var(--slot-busy)' }} /> Busy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--slot-free)', border: '1px solid var(--border)' }} /> Free
            </span>
            {onBlocksChange && (
              <span className="ml-auto italic">Drag to toggle busy / free</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
