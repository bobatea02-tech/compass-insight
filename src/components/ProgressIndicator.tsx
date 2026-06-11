import { PALETTE } from '@/types/compass';

interface Props {
  current: number;
  total: number;
  currentPackage: string | null;
}

export function ProgressIndicator({ current, total, currentPackage }: Props) {
  if (!currentPackage) return null;
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="mt-4 fade-in">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span style={{ color: PALETTE.textMuted }}>
          Analyzing <span className="font-mono" style={{ color: PALETTE.lime }}>{currentPackage}</span>
        </span>
        <span className="font-mono" style={{ color: PALETTE.textDim }}>
          {current}/{total}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 6, background: PALETTE.surfaceAlt }}
      >
        <div
          className="stripe-anim h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${PALETTE.lime}, ${PALETTE.orange})`,
            transition: 'width 350ms ease-out',
            boxShadow: `0 0 12px rgba(184,232,74,0.45)`,
          }}
        />
      </div>
    </div>
  );
}
