import { useEffect, useRef, useState } from 'react';
import { PALETTE } from '@/types/compass';

interface Props {
  text: string;
  generating: boolean;
  complete: boolean;
  packageName: string | null;
  started: boolean;
  fileName?: string | null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function StreamingReport({ text, generating, complete, packageName, started, fileName }: Props) {
  const [copied, setCopied] = useState(false);
  const [displayed, setDisplayed] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reducedRef = useRef(prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (reducedRef.current || complete) {
      setDisplayed(text);
      return;
    }
    if (displayed.length >= text.length) {
      if (displayed.length > text.length) setDisplayed(text);
      return;
    }
    const tick = () => {
      setDisplayed((cur) => {
        if (cur.length >= text.length) return cur;
        const remaining = text.length - cur.length;
        const step = Math.max(1, Math.min(remaining, Math.ceil(remaining / 24) + 1));
        return text.slice(0, cur.length + step);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [text, complete, displayed.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 200) {
      el.scrollTo({ top: el.scrollHeight, behavior: reducedRef.current ? 'auto' : 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [displayed]);

  useEffect(() => {
    if (text === '') setDisplayed('');
  }, [text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `Compass Report - ${fileName ?? 'analysis'}`;
    const onAfter = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', onAfter);
    };
    window.addEventListener('afterprint', onAfter);
    window.print();
  };

  const renderText = () => {
    const t = displayed;
    if (!packageName || !t.includes(packageName)) return <span>{t}</span>;
    const idx = t.indexOf(packageName);
    return (
      <>
        <span>{t.slice(0, idx)}</span>
        <span style={{ color: PALETTE.lime, fontWeight: 600 }}>{packageName}</span>
        <span>{t.slice(idx + packageName.length)}</span>
      </>
    );
  };

  const showCursor = !complete || displayed.length < text.length;

  return (
    <div className="mt-4 fade-up print-report">
      <div className="print-only-block" aria-hidden>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Compass Dependency Report</h1>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
          {fileName ?? ''} · {new Date().toLocaleString()}
        </div>
        <hr style={{ margin: '12px 0', borderColor: '#ddd' }} />
      </div>
      <div
        className="uppercase mb-2 flex items-center gap-2 print-hide"
        style={{ fontSize: 10, fontWeight: 600, color: PALETTE.textMuted, letterSpacing: '0.18em' }}
      >
        <span className={generating ? 'spin-slow inline-block' : ''} style={{ color: PALETTE.lime }}>✦</span>
        Analysis Report
      </div>
      <div
        ref={ref}
        className="rounded-3xl print-report-body"
        style={{
          background: PALETTE.surfaceAlt,
          border: `1px solid ${PALETTE.border}`,
          padding: 16,
          maxHeight: 280,
          overflowY: 'auto',
          scrollBehavior: 'smooth',
        }}
      >
        {!started && (
          <div className="text-[12px]" style={{ color: PALETTE.textMuted }}>
            Select a package to start analysis
          </div>
        )}
        {started && generating && !displayed && (
          <div className="text-[12px] flex items-center gap-2" style={{ color: PALETTE.textMuted }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: PALETTE.lime, animation: 'blink 1s ease-in-out infinite' }}
            />
            Generating report<span className="inline-block animate-pulse">...</span>
          </div>
        )}
        {displayed && (
          <div
            className="font-mono text-[12px] print-report-text"
            style={{ color: PALETTE.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
          >
            {renderText()}
            {showCursor && (
              <span
                className="inline-block align-middle ml-0.5 print-hide"
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
        <div className="grid grid-cols-2 gap-2 mt-2 print-hide">
          <button
            onClick={handleCopy}
            className="py-2 rounded-full text-[11px] font-medium transition-all hover:scale-[1.01]"
            style={{
              background: copied ? PALETTE.limeSoft : PALETTE.surfaceAlt,
              border: `1px solid ${copied ? 'rgba(184,232,74,0.4)' : PALETTE.border}`,
              color: copied ? PALETTE.lime : PALETTE.text,
            }}
          >
            {copied ? 'Copied ✓' : 'Copy report'}
          </button>
          <button
            onClick={handlePrint}
            className="py-2 rounded-full text-[11px] font-medium transition-all hover:scale-[1.01]"
            style={{
              background: PALETTE.surfaceAlt,
              border: `1px solid ${PALETTE.border}`,
              color: PALETTE.text,
            }}
          >
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
