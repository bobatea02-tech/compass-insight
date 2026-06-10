import type { Incident } from '@/types/compass';

interface Props {
  incident: Incident;
}

export function IncidentCard({ incident }: Props) {
  const sim = incident.similarity;
  const simColor =
    sim > 0.7
      ? { bg: 'rgba(225,29,72,0.1)', text: '#E11D48' }
      : sim > 0.5
      ? { bg: 'rgba(255,176,32,0.1)', text: '#FFB020' }
      : { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8' };

  let host = '';
  try {
    host = new URL(incident.source_url).hostname.replace('www.', '');
  } catch {
    host = 'source';
  }

  return (
    <div
      className="rounded-lg mb-1.5"
      style={{
        background: '#0F1F38',
        border: '1px solid rgba(148,163,184,0.12)',
        padding: 11,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px]" style={{ fontWeight: 500, color: '#CBD5E1' }}>
          {host}
        </div>
        <span
          className="rounded-sm px-1.5 py-0.5"
          style={{ fontSize: 10, background: simColor.bg, color: simColor.text }}
        >
          {sim.toFixed(2)} match
        </span>
      </div>
      <div
        className="text-[11px] leading-relaxed line-clamp-3"
        style={{ color: '#64748B' }}
      >
        {incident.excerpt}
      </div>
      <a
        href={incident.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-block mt-1 text-[10px]"
        style={{ color: '#4338CA' }}
      >
        View source →
      </a>
    </div>
  );
}
