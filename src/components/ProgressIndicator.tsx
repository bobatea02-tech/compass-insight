import { useEffect, useState } from 'react';
import { PALETTE } from '@/types/compass';

interface Props {
  current: number;
  total: number;
  currentPackage: string | null;
  startedAt: number | null;
}

export function ProgressIndicator({ current, total, currentPackage, startedAt }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!currentPackage) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [currentPackage]);

  if (!currentPackage) return null;
  const pct = total > 0 ? (current / total) * 100 : 0;

  let etaLabel = '';
  if (startedAt && current > 0 && current < total) {
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(1, Math.round((elapsed / current) * (total - current)));
    etaLabel = `~${remaining}s remaining`;
  }

  return (
    <div className="mt-4 fade-in">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span style={{ color: PALETTE.textMuted }}>
          Analyzing <span className="font-mono" style={{ color: PALETTE.indigo }}>{currentPackage}</span>… (
          <span className="font-mono">{current}</span>/<span className="font-mono">{total}</span>)
        </span>
        <span className="font-mono" style={{ color: PALETTE.textDim }}>
          {etaLabel}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 4, background: PALETTE.surfaceAlt }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${PALETTE.indigo}, #A5B4FC)`,
            transition: 'width 350ms ease-out',
            boxShadow: `0 0 10px ${PALETTE.indigo}66`,
          }}
        />
      </div>
    </div>
  );
}
