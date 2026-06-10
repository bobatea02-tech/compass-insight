interface Props {
  healthy: number;
  atRisk: number;
  dying: number;
}

export function StatsBar({ healthy, atRisk, dying }: Props) {
  const items = [
    { n: healthy, label: 'healthy', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    { n: atRisk, label: 'at risk', color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
    { n: dying, label: 'dying', color: '#E11D48', bg: 'rgba(225,29,72,0.1)' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg text-center"
          style={{ background: it.bg, padding: '10px 6px' }}
        >
          <div style={{ fontSize: 20, fontWeight: 500, color: it.color }} className="font-mono">
            {it.n}
          </div>
          <div style={{ fontSize: 10, color: it.color }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}
