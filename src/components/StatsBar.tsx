import { PALETTE, RISK_COLORS } from '@/types/compass';

interface Props {
  healthy: number;
  atRisk: number;
  dying: number;
  unresolved?: number;
}

export function StatsBar({ healthy, atRisk, dying, unresolved = 0 }: Props) {
  const items = [
    { n: healthy, label: 'healthy', color: PALETTE.lime, bg: PALETTE.limeSoft, border: 'rgba(184,232,74,0.3)' },
    { n: atRisk, label: 'at risk', color: PALETTE.orange, bg: PALETTE.orangeSoft, border: 'rgba(245,158,66,0.3)' },
    { n: dying, label: 'dying', color: PALETTE.red, bg: PALETTE.redSoft, border: 'rgba(232,93,93,0.3)' },
  ];
  const legend = [
    { color: PALETTE.lime, label: 'Healthy' },
    { color: PALETTE.orange, label: 'At Risk' },
    { color: PALETTE.red, label: 'Dying' },
    { color: RISK_COLORS.Unknown.text, label: 'Unresolved' },
  ];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mt-4 fade-up">
        {items.map((it, i) => (
          <div
            key={it.label}
            className="rounded-2xl text-center transition-transform hover:-translate-y-0.5"
            style={{
              background: PALETTE.surfaceAlt,
              border: `1px solid ${it.border}`,
              padding: '12px 6px',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div
              style={{ fontSize: 22, fontWeight: 700, color: it.color, textShadow: `0 0 12px ${it.color}55` }}
              className="font-mono"
            >
              {it.n}
            </div>
            <div style={{ fontSize: 9, color: it.color, letterSpacing: '0.15em' }} className="uppercase mt-0.5">
              {it.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5" style={{ fontSize: 10, color: PALETTE.textMuted }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
        {unresolved > 0 && (
          <span className="font-mono" style={{ fontSize: 10, color: PALETTE.textDim }}>
            · {unresolved} unresolved
          </span>
        )}
      </div>
    </>
  );
}
