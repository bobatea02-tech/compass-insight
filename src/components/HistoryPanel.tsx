import { useEffect, useState } from 'react';
import { API_URL, PALETTE } from '@/types/compass';

interface HistoryItem {
  id?: string;
  filename: string;
  date?: string;
  created_at?: string;
  package_count?: number;
  packages?: number;
  healthy?: number;
  at_risk?: number;
  dying?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HistoryPanel({ open, onClose }: Props) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setError(null);
    const ctrl = new AbortController();
    fetch(`${API_URL}/history`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const arr: HistoryItem[] = Array.isArray(data) ? data : (data?.history ?? data?.items ?? []);
        setItems(arr.slice(0, 10));
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message || 'Failed to load history');
          setItems([]);
        }
      });
    return () => ctrl.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fmt = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 print-hide"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.55)', animation: 'fadeIn 160ms ease-out' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-[380px] max-w-[90vw] overflow-y-auto p-5 fade-in"
        style={{
          background: '#0A0A0A',
          borderLeft: `1px solid ${PALETTE.border}`,
          boxShadow: '-12px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text, letterSpacing: '0.04em' }}>
              SCAN HISTORY
            </div>
            <div className="uppercase mt-0.5" style={{ fontSize: 9, color: PALETTE.textDim, letterSpacing: '0.18em' }}>
              last 10 analyses
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PALETTE.textMuted} strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div
            className="text-[11px] rounded-xl px-3 py-2 mb-3"
            style={{ background: PALETTE.redSoft, color: PALETTE.red, border: `1px solid rgba(232,93,93,0.3)` }}
          >
            {error}
          </div>
        )}

        {items === null && (
          <ul className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="rounded-xl shimmer-bg"
                style={{ height: 68, border: `1px solid ${PALETTE.border}` }}
              />
            ))}
          </ul>
        )}

        {items && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={PALETTE.textDim} strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <div className="text-[12px] mt-3" style={{ color: PALETTE.textMuted }}>
              No previous scans. Upload a manifest to start.
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((h, i) => {
              const date = h.date ?? h.created_at;
              const count = h.package_count ?? h.packages ?? 0;
              return (
                <li
                  key={h.id ?? `${h.filename}-${i}`}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: PALETTE.surfaceAlt, border: `1px solid ${PALETTE.border}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] truncate" style={{ color: PALETTE.text, fontWeight: 500 }}>
                      {h.filename}
                    </span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: PALETTE.textDim }}>
                      {fmt(date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" style={{ fontSize: 10 }}>
                    <span
                      className="font-mono rounded-full px-2 py-0.5"
                      style={{ background: PALETTE.surface, color: PALETTE.textMuted, border: `1px solid ${PALETTE.border}` }}
                    >
                      {count} pkgs
                    </span>
                    <span
                      className="font-mono rounded-full px-2 py-0.5"
                      style={{ background: PALETTE.limeSoft, color: PALETTE.lime }}
                    >
                      ● {h.healthy ?? 0}
                    </span>
                    <span
                      className="font-mono rounded-full px-2 py-0.5"
                      style={{ background: PALETTE.orangeSoft, color: PALETTE.orange }}
                    >
                      ● {h.at_risk ?? 0}
                    </span>
                    <span
                      className="font-mono rounded-full px-2 py-0.5"
                      style={{ background: PALETTE.redSoft, color: PALETTE.red }}
                    >
                      ● {h.dying ?? 0}
                    </span>
                    <button
                      onClick={onClose}
                      className="ml-auto rounded-full px-2.5 py-0.5 hover:bg-white/5 transition-colors"
                      style={{ color: PALETTE.text, border: `1px solid ${PALETTE.border}` }}
                    >
                      View
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
