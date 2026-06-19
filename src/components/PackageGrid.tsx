import { useEffect, useRef, useState } from 'react';
import { PackageCard } from './PackageCard';
import type { PackageState } from '@/types/compass';

interface Props {
  packages: PackageState[];
  selected: string | null;
  analyzing: string | null;
  onSelect: (name: string) => void;
}

// FLIP-lite: animate card repositioning (150ms ease-out) using transforms.
export function PackageGrid({ packages, selected, analyzing, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const [, force] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>('[data-pkg]');
    nodes.forEach((n) => {
      const key = n.dataset.pkg!;
      const newRect = n.getBoundingClientRect();
      const prev = prevRects.current.get(key);
      if (prev) {
        const dx = prev.left - newRect.left;
        const dy = prev.top - newRect.top;
        if (dx || dy) {
          n.style.transition = 'none';
          n.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            n.style.transition = 'transform 150ms ease-out';
            n.style.transform = '';
          });
        }
      }
      prevRects.current.set(key, newRect);
    });
    // cleanup keys no longer present
    const keys = new Set(Array.from(nodes).map((n) => n.dataset.pkg!));
    for (const k of prevRects.current.keys()) if (!keys.has(k)) prevRects.current.delete(k);
    force((x) => x); // noop
  }, [packages]);

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-1.5 mt-3">
      {packages.map((p, i) => (
        <div key={p.name} data-pkg={p.name}>
          <PackageCard
            pkg={p}
            selected={selected === p.name}
            analyzing={analyzing === p.name}
            colIndex={i % 2}
            onClick={() => !p.loading && onSelect(p.name)}
          />
        </div>
      ))}
    </div>
  );
}
