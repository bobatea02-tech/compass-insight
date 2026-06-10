import { useRef } from 'react';

interface Props {
  fileName: string | null;
  packageCount: number;
  onFile: (content: string, filename: string, packages: string[]) => void;
  onClear: () => void;
}

function parsePackages(content: string, filename: string): string[] {
  if (filename.endsWith('.json')) {
    try {
      const j = JSON.parse(content);
      return [
        ...Object.keys(j.dependencies ?? {}),
        ...Object.keys(j.devDependencies ?? {}),
      ];
    } catch {
      return [];
    }
  }
  return content
    .split('\n')
    .map((l) => l.trim().split(/[=<>!~ ]/)[0])
    .filter((l) => l && !l.startsWith('#'));
}

export function ManifestUpload({ fileName, packageCount, onFile, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      onFile(content, file.name, parsePackages(content, file.name));
    };
    reader.readAsText(file);
  };

  if (fileName) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2 rounded-lg"
        style={{ background: '#0F1F38', border: '1px solid rgba(148,163,184,0.12)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="font-mono text-[12px] truncate" style={{ color: '#CBD5E1' }}>
            {fileName}
          </span>
          <span className="text-[11px] shrink-0" style={{ color: '#64748B' }}>
            {packageCount} pkgs
          </span>
        </div>
        <button onClick={onClear} className="p-1 rounded hover:bg-white/5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className="rounded-lg text-center cursor-pointer transition-colors"
      style={{
        border: '1px dashed rgba(148,163,184,0.2)',
        background: '#0F1F38',
        padding: 20,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#64748B"
        strokeWidth="2"
        className="mx-auto mb-2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <div className="text-[12px]" style={{ color: '#CBD5E1' }}>
        Drop requirements.txt or package.json
      </div>
      <div className="text-[11px] mt-1" style={{ color: '#64748B' }}>
        or click to browse
      </div>
    </div>
  );
}
