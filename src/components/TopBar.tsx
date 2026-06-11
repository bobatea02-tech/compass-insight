import type { ConnStatus } from '@/hooks/useMockWebSocket';
import { PALETTE } from '@/types/compass';

interface Props {
  status: ConnStatus;
  fileName: string | null;
  packageCount: number;
  useMock: boolean;
  onToggleMock: () => void;
  onNewScan: () => void;
}

export function TopBar({
  status,
  fileName,
  packageCount,
  useMock,
  onToggleMock,
  onNewScan,
}: Props) {
  const connected = status === 'open';
  return (
    <div
      className="h-14 flex items-center justify-between px-4 shrink-0 fade-in"
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

        <button
          onClick={onToggleMock}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105"
          style={
            useMock
              ? { background: PALETTE.surface, color: PALETTE.textMuted, border: `1px solid ${PALETTE.border}` }
              : { background: PALETTE.limeSoft, color: PALETTE.lime, border: `1px solid rgba(184,232,74,0.4)` }
          }
        >
          {useMock ? 'Mock' : 'Live'}
        </button>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={
            connected
              ? { background: PALETTE.limeSoft, color: PALETTE.lime, border: `1px solid rgba(184,232,74,0.35)` }
              : { background: PALETTE.surface, color: PALETTE.textMuted, border: `1px solid ${PALETTE.border}` }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: connected ? PALETTE.lime : PALETTE.textDim,
              boxShadow: connected ? `0 0 8px ${PALETTE.lime}` : 'none',
              animation: connected ? 'blink 1.6s ease-in-out infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 11 }}>{connected ? 'live' : 'offline'}</span>
        </div>

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
