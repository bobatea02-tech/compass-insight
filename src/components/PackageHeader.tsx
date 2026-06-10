import { RISK_COLORS, type PackageResult } from '@/types/compass';

interface Props {
  name: string;
  result: PackageResult;
}

export function PackageHeader({ name, result }: Props) {
  const c = RISK_COLORS[result.risk_class];
  const incidentCount = result.incidents.length;
  return (
    <div
      className="rounded-[10px] flex items-start justify-between gap-4 mb-3.5"
      style={{
        background: '#0F1F38',
        border: `1px solid ${c.border}`,
        padding: '14px 16px',
      }}
    >
      <div className="min-w-0">
        <div className="font-mono" style={{ fontSize: 17, fontWeight: 500, color: '#CBD5E1' }}>
          {name}
        </div>
        {result.github && (
          <div className="flex items-center gap-1.5 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#64748B">
              <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
            </svg>
            <span className="text-[11px]" style={{ color: '#64748B' }}>
              {result.github}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-[11px] rounded-sm px-2 py-0.5"
            style={{ background: c.bg, color: c.text }}
          >
            {result.confidence.toFixed(1)}% confidence
          </span>
          <span
            className="text-[11px] rounded-sm px-2 py-0.5"
            style={{ background: 'rgba(148,163,184,0.1)', color: '#64748B' }}
          >
            {incidentCount} incident{incidentCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono" style={{ fontSize: 32, fontWeight: 500, color: c.text }}>
          {result.risk_score ?? '—'}
        </div>
        <div
          className="rounded-full uppercase mt-1 inline-block"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '4px 8px',
            background: c.bg,
            color: c.text,
            letterSpacing: '0.05em',
          }}
        >
          {result.risk_class}
        </div>
      </div>
    </div>
  );
}
