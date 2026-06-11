import { PALETTE, RISK_COLORS, type PackageState } from '@/types/compass';

interface Props {
  pkg: PackageState;
  selected: boolean;
  analyzing: boolean;
  onClick: () => void;
}

export function PackageCard({ pkg, selected, analyzing, onClick }: Props) {
  const cls = pkg.result?.risk_class ?? 'Unknown';
  const c = RISK_COLORS[cls];
  const score = pkg.result?.risk_score;
  const loading = pkg.loading || !pkg.result;

  const isHealthy = cls === 'Healthy';
  const isAtRisk = cls === 'At Risk';
  const accentBg = loading ? PALETTE.surface : c.bg;
  const accentText = loading ? PALETTE.textMuted : c.text;

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`text-left rounded-2xl transition-all duration-200 cursor-pointer fade-up
        ${selected && !loading ? (isHealthy ? 'glow-lime' : isAtRisk ? 'glow-orange' : '') : ''}
        ${!loading ? 'hover:-translate-y-0.5' : ''}`}
      style={{
        background: PALETTE.surfaceAlt,
        border: `1px solid ${selected && !loading ? c.border : PALETTE.border}`,
        padding: '12px 12px',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-mono text-[11px] truncate ${loading ? 'shimmer-bg rounded' : ''}`}
          style={{ color: PALETTE.text, fontWeight: 500, padding: loading ? '2px 6px' : 0 }}
        >
          {loading ? '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' : pkg.name}
        </span>
        <span
          className="font-mono rounded-full shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 8px',
            background: accentBg,
            color: accentText,
            border: loading ? `1px solid ${PALETTE.border}` : `1px solid ${c.border}`,
          }}
        >
          {loading ? '···' : score}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5" style={{ fontSize: 10 }}>
        {analyzing && !loading === false && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: PALETTE.orange, animation: 'blink 1s ease-in-out infinite' }}
          />
        )}
        <span style={{ color: accentText, letterSpacing: '0.05em' }} className="uppercase">
          {loading ? (analyzing ? 'analyzing' : 'queued') : c.label}
        </span>
      </div>
    </button>
  );
}
