import { useEffect, useState } from 'react';
import { PALETTE, type ShapItem } from '@/types/compass';

interface Props {
  data: ShapItem[];
  packageKey: string;
}

export function ShapChart({ data, packageKey }: Props) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setAnimated(false);
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [packageKey]);

  const items = data.slice(0, 8);

  return (
    <div
      className="rounded-3xl fade-up"
      style={{
        background: PALETTE.surfaceAlt,
        border: `1px solid ${PALETTE.border}`,
        padding: '18px 20px',
      }}
    >
      <div
        className="uppercase mb-3 flex items-center gap-2"
        style={{ fontSize: 10, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.lime }} />
        Risk Signal Attribution
      </div>
      {items.map((it, i) => {
        const positive = it.shap > 0;
        const pct = Math.min(Math.abs(it.shap) * 100, 100);
        const color = positive ? PALETTE.orange : PALETTE.lime;
        return (
          <div key={it.feature} className="flex items-center mb-2" style={{ gap: 10 }}>
            <div
              className="text-[11px] truncate whitespace-nowrap"
              style={{ width: 150, color: PALETTE.textMuted }}
            >
              {it.feature}
            </div>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 10, background: '#0A0A0A', border: `1px solid ${PALETTE.border}` }}
            >
              <div
                style={{
                  width: animated ? `${pct}%` : '0%',
                  height: '100%',
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                  transition: `width 500ms cubic-bezier(0.4, 0, 0.2, 1) ${i * 50}ms`,
                  borderRadius: 999,
                  boxShadow: `0 0 10px ${color}66`,
                }}
              />
            </div>
            <div
              className="font-mono text-right"
              style={{ width: 52, fontSize: 10, fontWeight: 600, color }}
            >
              {positive ? '+' : ''}
              {it.shap.toFixed(3)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-3" style={{ fontSize: 10, color: PALETTE.textMuted }}>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: PALETTE.orange, boxShadow: `0 0 6px ${PALETTE.orange}` }}
          />
          increases risk
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: PALETTE.lime, boxShadow: `0 0 6px ${PALETTE.lime}` }}
          />
          reduces risk
        </div>
      </div>
    </div>
  );
}
