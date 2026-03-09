'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  onBlocksChange?: (blocks: BusyBlock[]) => void;
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

function isBusy(blocks: BusyBlock[], date: string, hour: number): boolean {
  const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  const slotEnd = new Date(slotStart.getTime() + 3_600_000);
  return blocks.some(
    (b) => b.busy && new Date(b.start) < slotEnd && new Date(b.end) > slotStart,
  );
}

// Rebuild blocks array from overrides applied on top of original blocks.
// Blocks outside the visible date/hour range are preserved unchanged.
function gridToBlocks(
  dates: string[],
  overrides: Map<string, boolean>,
  original: BusyBlock[],
): BusyBlock[] {
  const dateSet = new Set(dates);
  const minHour = HOURS[0];
  const maxHourEnd = HOURS[HOURS.length - 1] + 1;

  const preserved = original.filter((b) => {
    if (!b.busy) return false;
    const date = b.start.split('T')[0];
    if (!dateSet.has(date)) return true; // outside visible date range
    const hour = new Date(b.start).getUTCHours();
    return hour < minHour || hour >= maxHourEnd; // outside visible hour range
  });

  const inView: BusyBlock[] = [];
  for (const date of dates) {
    for (const hour of HOURS) {
      const key = `${date}:${hour}`;
      const busy = overrides.has(key) ? overrides.get(key)! : isBusy(original, date, hour);
      if (busy) {
        const h = String(hour).padStart(2, '0');
        const h1 = String(hour + 1).padStart(2, '0');
        inView.push({ start: `${date}T${h}:00:00.000Z`, end: `${date}T${h1}:00:00.000Z`, busy: true, allDay: false });
      }
    }
  }

  return [...preserved, ...inView];
}

export function AvailabilityGrid({ blocks, fromDate, toDate, onBlocksChange }: Props) {
  const dates = getDates(fromDate, toDate);
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);

  // Stable refs so the global mouseup handler always sees latest state
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const datesRef = useRef(dates);
  datesRef.current = dates;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const onBlocksChangeRef = useRef(onBlocksChange);
  onBlocksChangeRef.current = onBlocksChange;

  // Clear local overrides when the parent replaces the block list
  useEffect(() => {
    setOverrides(new Map());
  }, [blocks]);

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
    onBlocksChangeRef.current?.(gridToBlocks(datesRef.current, next, blocksRef.current));
  }, []);

  // Global mouseup so drag commits even if pointer leaves the table
  useEffect(() => {
    function onMouseUp() {
      const d = dragRef.current;
      if (d) {
        commitDrag(d);
        setDrag(null);
      }
    }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [commitDrag]);

  function isEffectivelyBusy(row: number, col: number): boolean {
    if (drag) {
      const minRow = Math.min(drag.startRow, drag.currentRow);
      const maxRow = Math.max(drag.startRow, drag.currentRow);
      const minCol = Math.min(drag.startCol, drag.currentCol);
      const maxCol = Math.max(drag.startCol, drag.currentCol);
      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) return drag.mode;
    }
    const key = `${dates[col]}:${HOURS[row]}`;
    if (overrides.has(key)) return overrides.get(key)!;
    return isBusy(blocks, dates[col], HOURS[row]);
  }

  function inDragRect(row: number, col: number): boolean {
    if (!drag) return false;
    return (
      row >= Math.min(drag.startRow, drag.currentRow) &&
      row <= Math.max(drag.startRow, drag.currentRow) &&
      col >= Math.min(drag.startCol, drag.currentCol) &&
      col <= Math.max(drag.startCol, drag.currentCol)
    );
  }

  function cellClass(row: number, col: number): string {
    const busy = isEffectivelyBusy(row, col);

    if (inDragRect(row, col)) {
      return `border border-blue-300 h-4 ${drag!.mode ? 'bg-red-400' : 'bg-green-300'}`;
    }

    const isHoveredRow = !drag && hovered?.row === row;
    const isHoveredCol = !drag && hovered?.col === col;

    if (isHoveredRow && isHoveredCol) return 'border border-blue-400 h-4 bg-blue-300';
    if (isHoveredRow || isHoveredCol) {
      return `border border-blue-100 h-4 ${busy ? 'bg-red-300' : 'bg-green-200'}`;
    }
    return `border border-gray-100 h-4 ${busy ? 'bg-red-200' : 'bg-green-100'}`;
  }

  function handleCellMouseDown(row: number, col: number) {
    const busy = isEffectivelyBusy(row, col);
    setDrag({ startRow: row, startCol: col, currentRow: row, currentCol: col, mode: !busy });
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={`text-xs border-collapse min-w-full ${drag ? 'select-none' : ''}`}
        onMouseLeave={() => { if (!drag) setHovered(null); }}
      >
        <thead>
          <tr>
            <th className="w-12 text-right pr-2 text-gray-400 font-normal" />
            {dates.map((d, ci) => (
              <th
                key={d}
                className={`px-1 py-1 font-medium min-w-[36px] text-center ${
                  hovered?.col === ci && !drag ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {d.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour, ri) => (
            <tr key={hour}>
              <td
                className={`text-right pr-2 py-0 leading-none ${
                  hovered?.row === ri && !drag ? 'text-blue-600 font-semibold' : 'text-gray-400'
                }`}
              >
                {String(hour).padStart(2, '0')}:00
              </td>
              {dates.map((_, ci) => (
                <td
                  key={ci}
                  className={cellClass(ri, ci)}
                  onMouseDown={() => handleCellMouseDown(ri, ci)}
                  onMouseEnter={() => {
                    setHovered({ row: ri, col: ci });
                    setDrag((prev) => prev ? { ...prev, currentRow: ri, currentCol: ci } : null);
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" /> Busy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-100 inline-block" /> Free
        </span>
        {onBlocksChange && (
          <span className="ml-auto italic">Drag to toggle busy / free</span>
        )}
      </div>
    </div>
  );
}
