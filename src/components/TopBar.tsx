import type { ConnStatus } from '@/hooks/useMockWebSocket';
import { PALETTE } from '@/types/compass';

interface Props {
  status: ConnStatus;
  fileName: string | null;
  packageCount: number;
  onNewScan: () => void;
  onOpenHistory: () => void;
}

export function TopBar({ status, fileName, packageCount, onNewScan, onOpenHistory }: Props) {
  const conn =
    status === 'open'
      ? { color: PALETTE.lime, label: 'live', glow: true }
      : status === 'connecting'
      ? { color: PALETTE.orange, label: 'connecting…', glow: true }
      : { color: PALETTE.red, label: 'offline', glow: false };

  return (
    <div
      className="h-14 flex items-center justify-between px-4 shrink-0 fade-in print-hide"
      style={{ background: '#0A0A0A', borderBottom: `1px solid ${PALETTE.border}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center float-soft"
          style={{
            background: '#000',
            border: `1.5px solid ${PALETTE.lime}`,
            boxShadow: `0 0 18px rgba(184,232,74,0.35)`,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PALETTE.lime} strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <polygon points="14 10 10 14 12 12" fill={PALETTE.lime} />
            <polygon points="14 10 16 8 12 12" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span style={{ color: PALETTE.text, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>
            COMPASS
          </span>
          <span style={{ color: PALETTE.textDim, fontSize: 10, letterSpacing: '0.18em' }} className="uppercase">
            dependency intel
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {fileName && (
          <span
            className="font-mono px-3 py-1.5 rounded-full"
            style={{
              fontSize: 11,
              color: PALETTE.textMuted,
              background: PALETTE.surface,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            {fileName} · <span style={{ color: PALETTE.lime }}>{packageCount}</span> pkgs
          </span>
        )}

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            background: PALETTE.surface,
            color: conn.color,
            border: `1px solid ${PALETTE.border}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: conn.color,
              boxShadow: conn.glow ? `0 0 8px ${conn.color}` : 'none',
              animation: conn.glow ? 'blink 1.6s ease-in-out infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 11 }}>{conn.label}</span>
        </div>

        <button
          onClick={onOpenHistory}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 flex items-center gap-1.5"
          style={{
            background: PALETTE.surface,
            color: PALETTE.text,
            border: `1px solid ${PALETTE.border}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
          History
        </button>

        <button
          onClick={onNewScan}
          className="px-4 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105"
          style={{
            background: PALETTE.lime,
            color: '#0A0A0A',
            boxShadow: `0 0 20px rgba(184,232,74,0.35)`,
          }}
        >
          + New scan
        </button>
      </div>
    </div>
  );
}
