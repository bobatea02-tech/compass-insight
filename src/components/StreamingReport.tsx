import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  generating: boolean;
  complete: boolean;
  packageName: string | null;
  started: boolean;
}

export function StreamingReport({ text, generating, complete, packageName, started }: Props) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Highlight first occurrence of packageName in rose
  const renderText = () => {
    if (!packageName || !text.includes(packageName)) {
      return <span>{text}</span>;
    }
    const idx = text.indexOf(packageName);
    return (
      <>
        <span>{text.slice(0, idx)}</span>
        <span style={{ color: '#E11D48', fontWeight: 500 }}>{packageName}</span>
        <span>{text.slice(idx + packageName.length)}</span>
      </>
    );
  };

  return (
    <div className="mt-4">
      <div
        className="uppercase mb-2"
        style={{ fontSize: 10, fontWeight: 500, color: '#64748B', letterSpacing: '0.15em' }}
      >
        <span style={{ color: '#4338CA' }}>✦</span> Analysis Report
      </div>
      <div
        ref={ref}
        className="rounded-lg"
        style={{
          background: '#0F1F38',
          border: '1px solid rgba(148,163,184,0.12)',
          padding: 12,
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {!started && (
          <div className="text-[12px]" style={{ color: '#64748B' }}>
            Select a package to start analysis
          </div>
        )}
        {started && generating && !text && (
          <div className="text-[12px]" style={{ color: '#64748B' }}>
            Generating report
            <span className="inline-block animate-pulse">...</span>
          </div>
        )}
        {text && (
          <div
            className="font-mono text-[12px]"
            style={{ color: '#CBD5E1', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
          >
            {renderText()}
            {!complete && (
              <span
                className="inline-block align-middle ml-0.5"
                style={{
                  width: 2,
                  height: 14,
                  background: '#CBD5E1',
                  animation: 'blink 1s step-end infinite',
                }}
              />
            )}
          </div>
        )}
      </div>
      {complete && text && (
        <button
          onClick={handleCopy}
          className="w-full mt-2 py-1.5 rounded text-[11px] transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid rgba(148,163,184,0.2)',
            color: '#CBD5E1',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#0F1F38')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {copied ? 'Copied ✓' : 'Copy report'}
        </button>
      )}
    </div>
  );
}
