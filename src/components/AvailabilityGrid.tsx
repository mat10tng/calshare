'use client';
import type { BusyBlock } from '@/types';

interface Props {
  blocks: BusyBlock[];
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
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

export function AvailabilityGrid({ blocks, fromDate, toDate }: Props) {
  const dates = getDates(fromDate, toDate);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="w-12 text-right pr-2 text-gray-400 font-normal" />
            {dates.map((d) => (
              <th key={d} className="px-1 py-1 font-medium text-gray-500 min-w-[36px] text-center">
                {d.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <td className="text-right pr-2 text-gray-400 py-0 leading-none">
                {String(hour).padStart(2, '0')}:00
              </td>
              {dates.map((d) => (
                <td
                  key={d}
                  className={`border border-gray-100 h-4 ${
                    isBusy(blocks, d, hour) ? 'bg-red-200' : 'bg-green-100'
                  }`}
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
      </div>
    </div>
  );
}
