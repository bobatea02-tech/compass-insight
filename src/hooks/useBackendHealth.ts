import { useEffect, useState } from 'react';

export type HealthStatus = 'open' | 'connecting' | 'closed';

function getApiUrl(): string | null {
  const url = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (url) return url.replace(/\/$/, '');
  const ws = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, 'http').replace(/\/ws\/?.*$/, '').replace(/\/$/, '');
  return null;
}

export function useBackendHealth(intervalMs = 15000): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('connecting');

  useEffect(() => {
    const base = getApiUrl();
    if (!base) {
      setStatus('closed');
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
        setStatus(res.ok ? 'open' : 'closed');
      } catch {
        if (!cancelled) setStatus('closed');
      } finally {
        if (!cancelled) timer = setTimeout(ping, intervalMs);
      }
    };

    ping();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return status;
}
