import { useEffect, useRef, useState } from 'react';
import { PALETTE } from '@/types/compass';

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

  const renderText = () => {
    if (!packageName || !text.includes(packageName)) {
      return <span>{text}</span>;
    }
    const idx = text.indexOf(packageName);
    return (
      <>
        <span>{text.slice(0, idx)}</span>
        <span style={{ color: PALETTE.lime, fontWeight: 600 }}>{packageName}</span>
        <span>{text.slice(idx + packageName.length)}</span>
      </>
    );
  };

  return (
    <div className="mt-4 fade-up">
      <div
        className="uppercase mb-2 flex items-center gap-2"
        style={{ fontSize: 10, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
      >
        <span className={generating ? 'spin-slow inline-block' : ''} style={{ color: PALETTE.lime }}>✦</span>
        Analysis Report
      </div>
      <div
        ref={ref}
        className="rounded-3xl"
        style={{
          background: PALETTE.surfaceAlt,
          border: `1px solid ${PALETTE.border}`,
          padding: 16,
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        {!started && (
          <div className="text-[12px]" style={{ color: PALETTE.textMuted }}>
            Select a package to start analysis
          </div>
        )}
        {started && generating && !text && (
          <div className="text-[12px] flex items-center gap-2" style={{ color: PALETTE.textMuted }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: PALETTE.lime, animation: 'blink 1s ease-in-out infinite' }}
            />
            Generating report<span className="inline-block animate-pulse">...</span>
          </div>
        )}
        {text && (
          <div
            className="font-mono text-[12px]"
            style={{ color: PALETTE.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
          >
            {renderText()}
            {!complete && (
              <span
                className="inline-block align-middle ml-0.5"
                style={{
                  width: 6,
                  height: 14,
                  background: PALETTE.lime,
                  boxShadow: `0 0 8px ${PALETTE.lime}`,
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
          className="w-full mt-2 py-2 rounded-full text-[11px] font-medium transition-all hover:scale-[1.01]"
          style={{
            background: copied ? PALETTE.limeSoft : PALETTE.surfaceAlt,
            border: `1px solid ${copied ? 'rgba(184,232,74,0.4)' : PALETTE.border}`,
            color: copied ? PALETTE.lime : PALETTE.text,
          }}
        >
          {copied ? '✓ Copied to clipboard' : 'Copy report'}
        </button>
      )}
    </div>
  );
}
