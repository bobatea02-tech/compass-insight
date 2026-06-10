import { useEffect, useState } from 'react';
import type { ShapItem } from '@/types/compass';

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
    <div>
      <div
        className="uppercase mb-2.5"
        style={{ fontSize: 10, fontWeight: 500, color: '#64748B', letterSpacing: '0.15em' }}
      >
        Risk Signal Attribution
      </div>
      {items.map((it, i) => {
        const positive = it.shap > 0;
        const pct = Math.min(Math.abs(it.shap) * 100, 100);
        const fill = positive ? 'rgba(225,29,72,0.6)' : 'rgba(16,185,129,0.6)';
        const stroke = positive ? 'rgba(225,29,72,0.4)' : 'rgba(16,185,129,0.4)';
        return (
          <div
            key={it.feature}
            className="flex items-center mb-1.5"
            style={{ gap: 10 }}
          >
            <div
              className="text-[11px] truncate whitespace-nowrap"
              style={{ width: 150, color: '#64748B' }}
            >
              {it.feature}
            </div>
            <div
              className="flex-1 rounded-sm overflow-hidden"
              style={{ height: 12, background: '#1E2D42' }}
            >
              <div
                style={{
                  width: animated ? `${pct}%` : '0%',
                  height: '100%',
                  background: fill,
                  border: `0.5px solid ${stroke}`,
                  transition: `width 400ms ease-out ${i * 40}ms`,
                  borderRadius: 2,
                }}
              />
            </div>
            <div
              className="font-mono text-right"
              style={{
                width: 48,
                fontSize: 10,
                fontWeight: 500,
                color: positive ? '#E11D48' : '#10B981',
              }}
            >
              {positive ? '+' : ''}
              {it.shap.toFixed(3)}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-2" style={{ fontSize: 10, color: '#64748B' }}>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: 'rgba(225,29,72,0.6)' }}
          />
          increases risk
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: 'rgba(16,185,129,0.6)' }}
          />
          reduces risk
        </div>
      </div>
    </div>
  );
}
