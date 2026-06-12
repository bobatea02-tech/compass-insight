import { useEffect, useState } from 'react';
import { PALETTE, type PackageState } from '@/types/compass';

export interface HistoryEntry {
  id: string;
  projectName: string;
  fileName: string;
  packageCount: number;
  date: string; // ISO
  healthy: number;
  atRisk: number;
  dying: number;
  packages?: PackageState[];
  reportText?: string;
}

const KEY = 'compass.scan.history';

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry) {
  const cur = loadHistory();
  const next = [entry, ...cur].slice(0, 25);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('compass:history'));
}

export function clearHistory() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('compass:history'));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  onSelect?: (entry: HistoryEntry) => void;
}

export function ScanHistory({ onSelect }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    refresh();
    window.addEventListener('compass:history', refresh);
    return () => window.removeEventListener('compass:history', refresh);
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="mt-4 fade-up">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="uppercase flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ fontSize: 10, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 160ms' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Scan history · {history.length}
        </button>
        <button
          onClick={() => {
            if (confirm('Clear all scan history?')) clearHistory();
          }}
          className="text-[10px] hover:opacity-100 opacity-60"
          style={{ color: PALETTE.textDim }}
        >
          clear
        </button>
      </div>
      {open && (
        <ul className="space-y-1.5">
          {history.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => onSelect?.(h)}
                className="w-full text-left rounded-xl px-3 py-2 transition-all hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                style={{
                  background: PALETTE.surfaceAlt,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[12px] truncate"
                    style={{ color: PALETTE.text, fontWeight: 500 }}
                  >
                    {h.projectName || h.fileName}
                  </span>
                  <span
                    className="font-mono text-[10px] shrink-0"
                    style={{ color: PALETTE.textDim }}
                  >
                    {formatDate(h.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono" style={{ fontSize: 10 }}>
                  <span style={{ color: PALETTE.textMuted }}>{h.packageCount} pkgs</span>
                  <span style={{ color: PALETTE.lime }}>● {h.healthy}</span>
                  <span style={{ color: PALETTE.orange }}>● {h.atRisk}</span>
                  <span style={{ color: PALETTE.red }}>● {h.dying}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
