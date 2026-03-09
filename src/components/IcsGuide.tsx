'use client';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  onFileReady: (file: File) => void;
}

const PROVIDERS = {
  google: {
    label: '📅 Google Calendar',
    exportUrl: 'https://calendar.google.com/calendar/r/settings/export',
    steps: [
      'Click "Open export page →" below — it takes you straight there',
      'Click the blue Export button — downloads a .zip file',
      'Unzip the downloaded file to find your .ics files',
      'Upload the .ics file using the button below',
    ],
  },
  outlook: {
    label: '📧 Outlook.com (personal)',
    exportUrl: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars',
    steps: [
      'Click "Open export page →" below',
      'Under "Publish a calendar", select your calendar and set permissions to "Can view all details"',
      'Click Publish — an ICS link appears below the button',
      'Click the ICS link to download the .ics file',
      'Upload the downloaded .ics file using the button below',
    ],
  },
  office365: {
    label: '🏢 Microsoft 365 (work/school)',
    exportUrl: 'https://outlook.office.com/calendar/0/options/calendar/SharedCalendars',
    steps: [
      'Click "Open export page →" below',
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ics-guide-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 id="ics-guide-title" className="text-lg font-semibold">
            Export your calendar manually
          </h2>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          No OAuth needed — export your calendar yourself and upload the file.
          Your raw event data never leaves your device.
        </p>

        {!provider ? (
          <div className="flex gap-3">
            {(Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>).map((key) => (
              <button
                key={key}
                onClick={() => setProvider(key)}
                className="flex-1 border rounded-lg p-4 hover:bg-gray-50 text-sm font-medium text-center transition-colors"
              >
                {PROVIDERS[key].label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={() => setProvider(null)}
              className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1"
            >
              ← Back
            </button>
            <a
              href={PROVIDERS[provider].exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors mb-5"
            >
              Open export page →
            </a>
            <ol className="space-y-2 mb-5">
              {PROVIDERS[provider].steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 rounded-lg px-4 py-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
              <span className="text-sm font-medium text-blue-700">
                Upload your .ics file
              </span>
              <input
                type="file"
                accept=".ics"
                className="sr-only"
                onChange={handleFile}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
