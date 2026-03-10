'use client';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  onFileReady: (file: File) => void;
}

const PROVIDERS = {
  google: {
    label: 'Google Calendar',
    exportUrl: 'https://calendar.google.com/calendar/r/settings/export',
    steps: [
      'Click "Open export page" below — it takes you straight there',
      'Click the blue Export button — downloads a .zip file',
      'Unzip the downloaded file to find your .ics files',
      'Upload the .ics file using the button below',
    ],
  },
  outlook: {
    label: 'Outlook.com',
    exportUrl: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars',
    steps: [
      'Click "Open export page" below',
      'Under "Publish a calendar", select your calendar and set permissions to "Can view all details"',
      'Click Publish — an ICS link appears below the button',
      'Click the ICS link to download the .ics file',
      'Upload the downloaded .ics file using the button below',
    ],
  },
  office365: {
    label: 'Microsoft 365',
    exportUrl: 'https://outlook.office.com/calendar/0/options/calendar/SharedCalendars',
    steps: [
      'Click "Open export page" below',
      'Under "Publish a calendar", select your calendar and set permissions to "Can view all details"',
      'Click Publish — an ICS link appears below the button',
      'Click the ICS link to download the .ics file',
      'Upload the downloaded .ics file using the button below',
    ],
  },
} as const;

export function IcsGuide({ onClose, onFileReady }: Props) {
  const [provider, setProvider] = useState<keyof typeof PROVIDERS | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileReady(file);
      onClose();
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ics-guide-title"
    >
      <div className="modal-panel">
        <div className="flex justify-between items-start mb-4">
          <h2 id="ics-guide-title" className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Export your calendar manually
          </h2>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="text-xl leading-none"
            style={{ color: 'var(--subtle)' }}
          >
            &times;
          </button>
        </div>

        <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
          No OAuth needed — export your calendar yourself and upload the file.
          Your raw event data never leaves your device.
        </p>

        {!provider ? (
          <div className="flex gap-3">
            {(Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>).map((key) => (
              <button
                key={key}
                onClick={() => setProvider(key)}
                className="btn btn-secondary flex-1 justify-center text-center"
                style={{ padding: '1rem', flexDirection: 'column', gap: '0.25rem' }}
              >
                {PROVIDERS[key].label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => setProvider(null)} className="back-link">
              &larr; Back
            </button>
            <a
              href={PROVIDERS[provider].exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full justify-center mb-5"
            >
              Open export page &rarr;
            </a>
            <ol className="space-y-2 mb-5">
              {PROVIDERS[provider].steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center"
                    style={{ background: 'var(--surface)', color: 'var(--foreground)' }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>{step}</span>
                </li>
              ))}
            </ol>
            <label
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-4 cursor-pointer transition-colors"
              style={{ border: '2px dashed var(--border-strong)', color: 'var(--foreground)' }}
            >
              <span className="text-sm font-medium">Upload your .ics file</span>
              <input type="file" accept=".ics" className="sr-only" onChange={handleFile} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
