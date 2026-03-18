'use client';
import { useState } from 'react';
import type { CalendarEvent, EventPrivacy } from '@/types';

interface Props {
  event?: CalendarEvent;
  defaultDate?: string;   // YYYY-MM-DD
  defaultHour?: number;   // 0-23
  defaultEndHour?: number; // 0-23
  defaultPrivacy?: EventPrivacy;
  onSave: (event: CalendarEvent) => void;
  onCancel: () => void;
}

const PRIVACY_OPTIONS: { value: EventPrivacy; label: string; desc: string }[] = [
  { value: 'busy-only', label: 'Busy only', desc: 'Others see a busy block, no details' },
  { value: 'title-only', label: 'Title only', desc: 'Others see the event title' },
  { value: 'full', label: 'Share everything', desc: 'Others see title and time details' },
];

export function EventModal({ event, defaultDate, defaultHour, defaultEndHour, defaultPrivacy, onSave, onCancel }: Props) {
  const isEdit = !!event;
  const isImported = event ? event.source !== 'manual' : false;

  const today = new Date().toISOString().split('T')[0];
  const initDate = event
    ? event.start.split('T')[0]
    : (defaultDate ?? today);
  const initStartHour = event
    ? new Date(event.start).getUTCHours()
    : (defaultHour ?? 9);
  const initStartMin = event
    ? new Date(event.start).getUTCMinutes()
    : 0;
  const initEndHour = event
    ? new Date(event.end).getUTCHours()
    : (defaultEndHour ?? Math.min((defaultHour ?? 9) + 1, 23));
  const initEndMin = event
    ? new Date(event.end).getUTCMinutes()
    : 0;

  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(initDate);
  const [startHour, setStartHour] = useState(initStartHour);
  const [startMin, setStartMin] = useState(initStartMin);
  const [endHour, setEndHour] = useState(initEndHour);
  const [endMin, setEndMin] = useState(initEndMin);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [busy, setBusy] = useState(event?.busy ?? true);
  const [privacy, setPrivacy] = useState<EventPrivacy>(event?.privacy ?? defaultPrivacy ?? 'busy-only');
  const [description, setDescription] = useState(event?.description ?? '');

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const isValid = title.trim().length > 0 && (allDay || endMinutes > startMinutes);

  function handleSave() {
    if (!isValid) return;

    const sh = String(startHour).padStart(2, '0');
    const sm = String(startMin).padStart(2, '0');
    const eh = String(endHour).padStart(2, '0');
    const em = String(endMin).padStart(2, '0');

    const saved: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
      start: allDay ? date : `${date}T${sh}:${sm}:00.000Z`,
      end: allDay ? date : `${date}T${eh}:${em}:00.000Z`,
      busy,
      allDay,
      privacy,
      source: event?.source ?? 'manual',
      sourceId: event?.sourceId,
      color: event?.color,
    };

    onSave(saved);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md mx-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          {isEdit ? 'Edit event' : 'New event'}
        </h2>

        {/* Title */}
        <div className="mb-3">
          <label className="label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Team standup"
            className="input w-full"
            maxLength={100}
            disabled={isImported}
            autoFocus
          />
        </div>

        {/* Date */}
        <div className="mb-3">
          <label className="label">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            disabled={isImported}
          />
        </div>

        {/* All day toggle */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            disabled={isImported}
          />
          <label htmlFor="allDay" className="text-sm" style={{ color: 'var(--foreground)' }}>All day</label>
        </div>

        {/* Time pickers */}
        {!allDay && (
          <div className="mb-3 flex gap-3">
            <div className="flex-1">
              <label className="label">Start</label>
              <div className="flex gap-1">
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="label">End</label>
              <div className="flex gap-1">
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={endMin}
                  onChange={(e) => setEndMin(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto' }}
                  disabled={isImported}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Busy/Free */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="busy"
            checked={busy}
            onChange={(e) => setBusy(e.target.checked)}
          />
          <label htmlFor="busy" className="text-sm" style={{ color: 'var(--foreground)' }}>
            Mark as busy
          </label>
        </div>

        {/* Privacy */}
        <div className="mb-3">
          <label className="label">Sharing</label>
          <div className="flex flex-col gap-1.5">
            {PRIVACY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer"
                style={{
                  background: privacy === opt.value ? 'var(--card-bg)' : 'transparent',
                  border: `1px solid ${privacy === opt.value ? 'var(--border-strong)' : 'transparent'}`,
                }}
              >
                <input
                  type="radio"
                  name="privacy"
                  value={opt.value}
                  checked={privacy === opt.value}
                  onChange={() => setPrivacy(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{opt.label}</span>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="label">
            Notes <span className="label-hint">(private — never shared)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes for yourself..."
            className="input w-full"
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Time validation error */}
        {!allDay && endMinutes <= startMinutes && title.trim().length > 0 && (
          <p className="msg-error mb-3">End time must be after start time</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="btn btn-primary btn-sm"
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
