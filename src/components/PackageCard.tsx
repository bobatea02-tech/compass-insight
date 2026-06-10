import { RISK_COLORS, type PackageState } from '@/types/compass';

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

  const borderWidth = selected ? 2 : 1;
  const borderColor = loading ? 'rgba(148,163,184,0.15)' : c.border;
  const bg = selected && !loading ? c.bg : '#0F1F38';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-left rounded-lg transition-all duration-150 cursor-pointer hover:brightness-110 animate-[fadeUp_200ms_ease-out]"
      style={{
        background: bg,
        border: `${borderWidth}px solid ${borderColor}`,
        padding: '10px 9px',
        animation: loading ? undefined : 'fadeUp 200ms ease-out',
        outline: analyzing ? '1px solid #4338CA' : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-mono text-[11px] truncate ${loading ? 'animate-pulse' : ''}`}
          style={{ color: '#CBD5E1', fontWeight: 500 }}
        >
          {pkg.name}
        </span>
        <span
          className="font-mono rounded-sm shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 6px',
            background: loading ? 'rgba(100,116,139,0.15)' : c.bg,
            color: loading ? '#64748B' : c.text,
          }}
        >
          {loading ? '...' : score}
        </span>
      </div>
      <div className="mt-1" style={{ fontSize: 10, color: loading ? '#64748B' : c.text }}>
        {loading ? 'analyzing' : c.label}
      </div>
    </button>
  );
}
