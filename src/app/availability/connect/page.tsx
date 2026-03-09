'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { AnonymisationPreview } from '@/components/AnonymisationPreview';
import { IcsGuide } from '@/components/IcsGuide';
import { parseIcsFile } from '@/lib/ics-parser';
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
      const content = await file.text();
      const blocks = parseIcsFile(content);
      setPending({ blocks, source: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse .ics file.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!pending) return;
    dispatch({ type: 'ADD_BLOCKS', blocks: pending.blocks });
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

      {/* Path A: OAuth (placeholder — implemented in Task 7) */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Connect via account</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleGoogleConnect}
            disabled={loading}
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="text-lg">📅</span>
            <span>Connect Google Calendar</span>
          </button>
          <button
            onClick={handleMicrosoftConnect}
            disabled={loading}
            className="flex items-center gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="text-lg">📧</span>
            <span>Connect Outlook / Microsoft 365</span>
          </button>
        </div>
      </section>

      {/* Path B: .ics upload */}
      <section className="mb-6">
        <h2 className="text-base font-semibold mb-3">Upload a calendar file</h2>
        <p className="text-sm text-gray-500 mb-3">
          Export your calendar as a <code className="bg-gray-100 px-1 rounded">.ics</code> file and upload it here.
          Nothing is sent to any server.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Processing…' : 'Click to choose .ics file'}
          </span>
          <input
            type="file"
            accept=".ics"
            className="sr-only"
            onChange={handleIcsUpload}
            disabled={loading}
          />
        </label>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </section>

      {/* Path C: Guided export (placeholder — implemented in Task 8) */}
      <p className="text-sm text-gray-500 text-center">
        Not sure how to export?{' '}
        <button onClick={() => setShowGuide(true)} className="text-blue-600 underline hover:text-blue-700">
          See step-by-step guide
        </button>
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
