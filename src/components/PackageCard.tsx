import { useState } from 'react';
import { PALETTE, RISK_COLORS, displayRiskClass, type PackageState } from '@/types/compass';

interface Props {
  pkg: PackageState;
  selected: boolean;
  analyzing: boolean;
  colIndex?: number;
  onClick: () => void;
}

export function PackageCard({ pkg, selected, analyzing, colIndex = 0, onClick }: Props) {
  const cls: keyof typeof RISK_COLORS = (pkg.result?.risk_class && RISK_COLORS[pkg.result.risk_class]) ? pkg.result.risk_class : 'Unknown';
  const c = RISK_COLORS[cls];
  const score = pkg.result?.risk_score;
  const loading = pkg.loading || !pkg.result;

  const isHealthy = cls === 'Healthy';
  const isAtRisk = cls === 'At Risk';
  const accentBg = loading ? PALETTE.surface : c.bg;
  const accentText = loading ? PALETTE.textMuted : c.text;

  const [hovered, setHovered] = useState(false);
  const topSignals = pkg.result?.top_signals?.slice(0, 3) ?? [];
  const incidentCount = pkg.result?.incidents?.filter((i) => i.similarity > 0.3).length ?? 0;
  const showTooltip = hovered && !loading && (topSignals.length > 0 || incidentCount > 0);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={onClick}
        disabled={loading}
        className={`w-full text-left rounded-2xl transition-all duration-200 cursor-pointer fade-up outline-none
          focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black
          ${selected && !loading ? (isHealthy ? 'glow-lime' : isAtRisk ? 'glow-orange' : '') : ''}
          ${!loading ? 'hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0 motion-reduce:transition-none' : ''}`}
        style={{
          background: PALETTE.surfaceAlt,
          border: `1px solid ${selected && !loading ? c.border : PALETTE.border}`,
          padding: '12px 12px',
          // @ts-expect-error css var
          '--tw-ring-color': c.border,
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
          {analyzing && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: PALETTE.orange, animation: 'blink 1s ease-in-out infinite' }}
            />
          )}
          <span style={{ color: accentText, letterSpacing: '0.05em' }} className="uppercase">
            {loading ? (analyzing ? 'analyzing' : 'queued') : displayRiskClass(cls).toLowerCase()}
          </span>
          {!loading && incidentCount > 0 && (
            <span
              className="ml-auto rounded-full px-1.5"
              style={{
                fontSize: 9,
                background: PALETTE.redSoft,
                color: PALETTE.red,
                border: `1px solid rgba(232,93,93,0.3)`,
              }}
            >
              {incidentCount} incident{incidentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>
      {showTooltip && (
        <div
          role="tooltip"
          className={`absolute top-full mt-2 z-30 w-60 max-w-[80vw] pointer-events-none tooltip-pop ${colIndex === 0 ? 'left-0' : 'right-0'}`}
          style={{
            background: '#0A0A0A',
            border: `1px solid ${PALETTE.borderStrong}`,
            borderRadius: 12,
            padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            transformOrigin: colIndex === 0 ? 'top left' : 'top right',
          }}
        >
          <div
            className="uppercase mb-1.5"
            style={{ fontSize: 9, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
          >
            Top signals
          </div>
          {topSignals.length === 0 ? (
            <div className="text-[11px]" style={{ color: PALETTE.textDim }}>No signals available</div>
          ) : (
            <ul className="space-y-1">
              {topSignals.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: PALETTE.text }}>
                  <span
                    className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: s.direction === 'increases' ? PALETTE.red : PALETTE.lime }}
                  />
                  <span className="font-mono leading-snug">{s.human_readable}</span>
                </li>
              ))}
            </ul>
          )}
          {incidentCount > 0 && (
            <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: `1px solid ${PALETTE.border}`, color: PALETTE.orange }}>
              ⚠ {incidentCount} related historical incident{incidentCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
