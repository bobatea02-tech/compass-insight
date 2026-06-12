import { PackageCard } from './PackageCard';
import type { PackageState } from '@/types/compass';

interface Props {
  packages: PackageState[];
  selected: string | null;
  analyzing: string | null;
  onSelect: (name: string) => void;
}

export function PackageGrid({ packages, selected, analyzing, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-3">
      {packages.map((p, i) => (
        <PackageCard
          key={p.name}
          pkg={p}
          selected={selected === p.name}
          analyzing={analyzing === p.name}
          colIndex={i % 2}
          onClick={() => !p.loading && onSelect(p.name)}
        />
      ))}
    </div>
  );
}
