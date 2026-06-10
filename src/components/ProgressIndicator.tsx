interface Props {
  current: number;
  total: number;
  currentPackage: string | null;
}

export function ProgressIndicator({ current, total, currentPackage }: Props) {
  if (!currentPackage) return null;
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="mt-3">
      <div className="text-[11px] mb-1" style={{ color: '#64748B' }}>
        Analyzing <span className="font-mono">{currentPackage}</span>... ({current}/{total})
      </div>
      <div className="w-full" style={{ height: 1, background: 'rgba(148,163,184,0.12)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#4338CA',
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
    </div>
  );
}
