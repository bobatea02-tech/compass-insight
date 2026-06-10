import type { ConnStatus } from '@/hooks/useMockWebSocket';

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
      className="h-12 flex items-center justify-between px-4 border-b shrink-0"
      style={{ background: '#0D1829', borderColor: 'rgba(148,163,184,0.12)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(232,98,42,0.18)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <polygon points="14 10 10 14 12 12" fill="#E8622A" />
            <polygon points="14 10 16 8 12 12" />
          </svg>
        </div>
        <span style={{ color: '#CBD5E1', fontSize: 14, fontWeight: 500 }}>Compass</span>
        <span className="ml-2" style={{ color: '#64748B', fontSize: 11 }}>
          dependency intelligence
        </span>
      </div>

      <div className="flex items-center gap-3">
        {fileName && (
          <span style={{ color: '#64748B', fontSize: 11 }} className="font-mono">
            {fileName} · {packageCount} packages
          </span>
        )}

        <button
          onClick={onToggleMock}
          className="px-2 py-0.5 rounded-full text-[11px] transition-colors"
          style={
            useMock
              ? { background: 'rgba(148,163,184,0.12)', color: '#94A3B8' }
              : { background: 'rgba(16,185,129,0.1)', color: '#10B981' }
          }
        >
          {useMock ? 'Mock' : 'Live'}
        </button>

        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={
            connected
              ? { background: 'rgba(16,185,129,0.1)', color: '#10B981' }
              : { background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: connected ? '#10B981' : '#64748B' }}
          />
          <span style={{ fontSize: 11 }}>{connected ? 'live' : 'offline'}</span>
        </div>

        <button
          onClick={onNewScan}
          className="px-3 py-1 rounded text-[11px] transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid rgba(148,163,184,0.2)',
            color: '#CBD5E1',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#0F1F38')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          New scan
        </button>
      </div>
    </div>
  );
}
