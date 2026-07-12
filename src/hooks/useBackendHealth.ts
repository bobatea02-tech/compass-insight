import { useEffect, useState } from 'react';

export type HealthStatus = 'open' | 'connecting' | 'closed';

function getApiUrl(): string | null {
  const url = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (url) return url.replace(/\/$/, '');
  const ws = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, 'http').replace(/\/ws\/?.*$/, '').replace(/\/$/, '');
  return null;
}

/**
 * Optimistic backend health.
 * - No backend configured (frontend-only / demo mode): always "open".
 * - Backend configured: poll /health. Only mark "closed" when the server
 *   explicitly responds with a non-OK status. Network errors keep the last
 *   good state so transient failures don't flip the pill offline.
 */
export function useBackendHealth(intervalMs = 20000): HealthStatus {
  const base = getApiUrl();
  const [status, setStatus] = useState<HealthStatus>('open');

  useEffect(() => {
    if (!base) {
      setStatus('open');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ping = async () => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${base}/health`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(to);
        if (cancelled) return;
        if (res.ok) setStatus('open');
        else setStatus('closed');
      } catch {
        // Network error — stay optimistic (frontend still works).
        if (!cancelled) setStatus((s) => (s === 'closed' ? 'closed' : 'open'));
      } finally {
        if (!cancelled) timer = setTimeout(ping, intervalMs);
      }
    };

    ping();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [base, intervalMs]);

  return status;
}
