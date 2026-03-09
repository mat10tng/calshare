'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { AnonymisationPreview } from '@/components/AnonymisationPreview';
import { IcsGuide } from '@/components/IcsGuide';
import { parseIcsFile, parseZipFile } from '@/lib/ics-parser';
import { generatePKCE, buildGoogleAuthUrl, exchangeGoogleCode } from '@/lib/oauth';
import { fetchGoogleEvents } from '@/lib/google-calendar';
import { acquireMicrosoftToken } from '@/lib/msal';
import { fetchMicrosoftEvents } from '@/lib/microsoft-calendar';
import type { BusyBlock } from '@/types';

interface PendingImport {
  blocks: BusyBlock[];
  source: string;
}

export default function ConnectPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const provider = sessionStorage.getItem('oauth_provider');
    const verifier = sessionStorage.getItem('pkce_verifier');

    if (!code || !verifier || !provider) return;

    // Clean up URL and session storage
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_provider');
    window.history.replaceState({}, '', '/availability/connect');

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const redirectUri = `${window.location.origin}/availability/connect`;
        let blocks;

        if (provider === 'google') {
          const token = await exchangeGoogleCode(code, verifier, redirectUri);
          blocks = await fetchGoogleEvents(token, state.preferences.lookAheadDays);
          setPending({ blocks, source: 'Google Calendar' });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth connection failed.');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMicrosoftConnect() {
    setLoading(true);
    setError(null);
    try {
      const token = await acquireMicrosoftToken();
      const blocks = await fetchMicrosoftEvents(token, state.preferences.lookAheadDays);
      setPending({ blocks, source: 'Outlook / Microsoft 365' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microsoft connection failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleConnect() {
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_provider', 'google');
    const redirectUri = `${window.location.origin}/availability/connect`;
    window.location.href = buildGoogleAuthUrl(redirectUri, challenge);
  }

  async function handleIcsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    setLoading(true);
    setError(null);
    try {
      let blocks;
      if (file.name.endsWith('.zip')) {
        blocks = await parseZipFile(await file.arrayBuffer());
      } else {
        blocks = parseIcsFile(await file.text());
      }
      setPending({ blocks, source: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm(blocks: import('@/types').BusyBlock[]) {
    dispatch({ type: 'ADD_BLOCKS', blocks });
    setPending(null);
    router.push('/availability');
  }

  function handleCancel() {
    setPending(null);
  }

  return (
    <main className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Connect your calendar</h1>
      <p className="text-sm text-gray-500 mb-8">
        Your calendar data is processed entirely in your browser. Event details are never stored or transmitted.
      </p>

      {/* Primary: File upload */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Upload a file</h2>
        <div className="flex flex-col gap-2 mb-4">
          <a
            href="https://calendar.google.com/calendar/r/settings/export"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">📅</span>
            <span>Export from Google Calendar →</span>
          </a>
          <a
            href="https://outlook.live.com/calendar/0/options/calendar/SharedCalendars"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">📧</span>
            <span>Export from Outlook.com (personal) →</span>
          </a>
          <a
            href="https://outlook.office.com/calendar/0/options/calendar/SharedCalendars"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">🏢</span>
            <span>Export from Microsoft 365 (work/school) →</span>
          </a>
        </div>
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <span className="text-3xl">📂</span>
          <span className="text-sm font-medium text-gray-700 text-center">
            {loading ? 'Processing…' : (
              <>
                Drop your .ics or .zip file here<br />
                <span className="text-gray-400 font-normal">or click to browse</span>
              </>
            )}
          </span>
          <input
            type="file"
            accept=".ics,.zip"
            className="sr-only"
            onChange={handleIcsUpload}
            disabled={loading}
          />
        </label>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <p className="text-sm text-gray-400 mt-2 text-center">
          Need step-by-step help?{' '}
          <button onClick={() => setShowGuide(true)} className="text-blue-600 underline hover:text-blue-700">
            See export guide
          </button>
        </p>
      </section>

      {/* Divider */}
      <div className="relative flex items-center mb-6">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">or connect instantly</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Secondary: OAuth */}
      <section className="mb-6">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleGoogleConnect}
            disabled={loading}
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="text-lg">📅</span>
            <span>Continue with Google</span>
          </button>
          <button
            onClick={handleMicrosoftConnect}
            disabled={loading}
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="text-lg">📧</span>
            <span>Continue with Microsoft / Outlook</span>
          </button>
        </div>
      </section>

      <p className="text-center text-sm text-gray-400 mt-2">
        No calendar to share?{' '}
        <Link href="/availability" className="text-blue-600 hover:underline">
          Skip — I&apos;m available whenever
        </Link>
      </p>

      {pending && (
        <AnonymisationPreview
          blocks={pending.blocks}
          source={pending.source}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      {showGuide && (
        <IcsGuide
          onClose={() => setShowGuide(false)}
          onFileReady={async (file) => {
            setShowGuide(false);
            setLoading(true);
            setError(null);
            try {
              const content = await file.text();
              const blocks = parseIcsFile(content);
              setPending({ blocks, source: file.name });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to parse .ics file.');
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </main>
  );
}
