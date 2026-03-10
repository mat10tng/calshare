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

  function handleConfirm(blocks: BusyBlock[]) {
    dispatch({ type: 'ADD_BLOCKS', blocks });
    setPending(null);
    router.push('/availability');
  }

  function handleCancel() {
    setPending(null);
  }

  return (
    <main className="page-container page-container--narrow">
      <Link href="/availability" className="back-link">&larr; Back</Link>

      <h1 className="page-title mb-2">Connect your calendar</h1>
      <p className="page-subtitle mb-8">
        Your calendar data is processed entirely in your browser. Event details are never stored or transmitted.
      </p>

      {/* Primary: File upload */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Upload a file</h2>
        <div className="flex flex-col gap-2 mb-4">
          {[
            { href: 'https://calendar.google.com/calendar/r/settings/export', label: 'Export from Google Calendar' },
            { href: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars', label: 'Export from Outlook.com (personal)' },
            { href: 'https://outlook.office.com/calendar/0/options/calendar/SharedCalendars', label: 'Export from Microsoft 365 (work/school)' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary justify-start"
              style={{ padding: '0.75rem 1rem' }}
            >
              {item.label} &rarr;
            </a>
          ))}
        </div>
        <label
          className="flex flex-col items-center justify-center gap-3 rounded-xl px-4 py-10 cursor-pointer transition-colors"
          style={{ border: '2px dashed var(--border-strong)', color: 'var(--muted)' }}
        >
          <span className="text-3xl">📂</span>
          <span className="text-sm font-medium text-center" style={{ color: 'var(--muted)' }}>
            {loading ? 'Processing…' : (
              <>
                Drop your .ics or .zip file here<br />
                <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>or click to browse</span>
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
        {error && <p className="msg-error mt-2">{error}</p>}
        <p className="text-sm text-center mt-2" style={{ color: 'var(--subtle)' }}>
          Need step-by-step help?{' '}
          <button onClick={() => setShowGuide(true)} className="underline" style={{ color: 'var(--muted)' }}>
            See export guide
          </button>
        </p>
      </section>

      {/* Divider */}
      <div className="divider-text"><span>or connect instantly</span></div>

      {/* Secondary: OAuth */}
      <section className="mb-6">
        <div className="flex flex-col gap-2">
          <button onClick={handleGoogleConnect} disabled={loading} className="btn btn-secondary justify-start" style={{ padding: '0.75rem 1rem', opacity: loading ? 0.5 : 1 }}>
            Continue with Google
          </button>
          <button onClick={handleMicrosoftConnect} disabled={loading} className="btn btn-secondary justify-start" style={{ padding: '0.75rem 1rem', opacity: loading ? 0.5 : 1 }}>
            Continue with Microsoft / Outlook
          </button>
        </div>
      </section>

      <p className="text-center text-sm" style={{ color: 'var(--subtle)' }}>
        No calendar to share?{' '}
        <Link href="/availability" className="underline" style={{ color: 'var(--muted)' }}>
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
