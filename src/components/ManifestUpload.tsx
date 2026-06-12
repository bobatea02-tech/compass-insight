import { useRef, useState } from 'react';
import { PALETTE } from '@/types/compass';

interface Props {
  fileName: string | null;
  packageCount: number;
  projectName: string;
  onProjectNameChange: (name: string) => void;
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

export function ManifestUpload({ fileName, packageCount, projectName, onProjectNameChange, onFile, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      onFile(content, file.name, parsePackages(content, file.name));
    };
    reader.readAsText(file);
  };

  const nameInput = (
    <div className="mb-2">
      <label
        className="block uppercase mb-1"
        style={{ fontSize: 9, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
      >
        Project name
      </label>
      <input
        type="text"
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
        placeholder="e.g. acme-api · my-side-project"
        maxLength={80}
        className="w-full rounded-xl px-3 py-2 text-[12px] font-mono outline-none transition-colors focus:border-[rgba(184,232,74,0.45)]"
        style={{
          background: PALETTE.surfaceAlt,
          border: `1px solid ${PALETTE.border}`,
          color: PALETTE.text,
        }}
      />
    </div>
  );

  if (fileName) {
    return (
      <>
      {nameInput}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl fade-in"
        style={{
          background: PALETTE.surfaceAlt,
          border: `1px solid rgba(184,232,74,0.25)`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: PALETTE.limeSoft }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PALETTE.lime} strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[12px] truncate" style={{ color: PALETTE.text }}>
              {fileName}
            </div>
            <div className="text-[10px]" style={{ color: PALETTE.textDim }}>
              {packageCount} packages parsed
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          className="p-1.5 rounded-full transition-colors hover:bg-white/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PALETTE.textMuted} strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
      </>
    );
  }

  return (
    <>
    {nameInput}
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className="rounded-2xl text-center cursor-pointer transition-all duration-200 fade-up"
      style={{
        border: `1.5px dashed ${drag ? PALETTE.lime : 'rgba(255,255,255,0.12)'}`,
        background: drag ? PALETTE.limeSoft : PALETTE.surfaceAlt,
        padding: 28,
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
      <div
        className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center float-soft"
        style={{
          background: PALETTE.limeSoft,
          border: `1px solid rgba(184,232,74,0.3)`,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PALETTE.lime} strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div className="text-[13px] font-medium" style={{ color: PALETTE.text }}>
        Drop manifest file here
      </div>
      <div className="text-[11px] mt-1" style={{ color: PALETTE.textDim }}>
        requirements.txt · package.json
      </div>
    </div>
  );
}
