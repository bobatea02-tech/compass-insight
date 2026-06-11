import { PALETTE, type Incident } from '@/types/compass';

interface Props {
  incident: Incident;
}

export function IncidentCard({ incident }: Props) {
  const sim = incident.similarity;
  const simColor =
    sim > 0.7
      ? { bg: PALETTE.redSoft, text: PALETTE.red, border: 'rgba(232,93,93,0.35)' }
      : sim > 0.5
      ? { bg: PALETTE.orangeSoft, text: PALETTE.orange, border: 'rgba(245,158,66,0.35)' }
      : { bg: 'rgba(138,138,138,0.1)', text: PALETTE.textMuted, border: PALETTE.border };

  let host = '';
  try {
    host = new URL(incident.source_url).hostname.replace('www.', '');
  } catch {
    host = 'source';
  }

  return (
    <div
      className="rounded-2xl mb-2 fade-up transition-transform hover:-translate-y-0.5"
      style={{
        background: PALETTE.surfaceAlt,
        border: `1px solid ${PALETTE.border}`,
        padding: 13,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-medium" style={{ color: PALETTE.text }}>
          {host}
        </div>
        <span
          className="rounded-full px-2 py-0.5"
          style={{
            fontSize: 10,
            background: simColor.bg,
            color: simColor.text,
            border: `1px solid ${simColor.border}`,
          }}
        >
          {sim.toFixed(2)} match
        </span>
      </div>
      <div
        className="text-[11px] leading-relaxed line-clamp-3"
        style={{ color: PALETTE.textMuted }}
      >
        {incident.excerpt}
      </div>
      <a
        href={incident.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-block mt-2 text-[10px] transition-colors"
        style={{ color: PALETTE.lime }}
      >
        View source →
      </a>
    </div>
  );
}
