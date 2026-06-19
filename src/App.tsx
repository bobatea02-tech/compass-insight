import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { ManifestUpload } from '@/components/ManifestUpload';
import { PackageGrid } from '@/components/PackageGrid';
import { StatsBar } from '@/components/StatsBar';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { PackageHeader } from '@/components/PackageHeader';
import { ShapChart } from '@/components/ShapChart';
import { IncidentCard } from '@/components/IncidentCard';
import { StreamingReport } from '@/components/StreamingReport';
import { HistoryPanel } from '@/components/HistoryPanel';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { PackageResult, PackageState, WsMessage } from '@/types/compass';
import { sortPackages } from '@/types/compass';

export function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [filePackages, setFilePackages] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const [packages, setPackages] = useState<PackageState[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [userSelected, setUserSelected] = useState(false);
  const [reportText, setReportText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportStarted, setReportStarted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reportRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const flushReport = useCallback(() => {
    rafRef.current = null;
    setReportText(reportRef.current);
  }, []);

  const packagesRef = useRef<PackageState[]>([]);
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      switch (msg.type) {
        case 'start': {
          const pkgs = (msg.packages as string[]) ?? [];
          setPackages(pkgs.map((n) => ({ name: n, loading: true })));
          setProgress({ current: 0, total: (msg.total as number) ?? pkgs.length });
          setScanStartedAt(Date.now());
          setSelected(null);
          setUserSelected(false);
          reportRef.current = '';
          setReportText('');
          setGenerating(false);
          setReportStarted(false);
          setComplete(false);
          setErrorMsg(null);
          break;
        }
        case 'progress': {
          setAnalyzing(msg.package as string);
          setProgress({ current: msg.current as number, total: msg.total as number });
          break;
        }
        case 'package_result': {
          const name = msg.package as string;
          const result = msg.result as PackageResult;
          setPackages((prev) => prev.map((p) => (p.name === name ? { ...p, loading: false, result } : p)));
          setSelected((cur) => {
            if (userSelected) return cur;
            const curScore = (() => {
              if (!cur) return -1;
              const found = packagesRef.current.find((p) => p.name === cur);
              return found?.result?.risk_score ?? -1;
            })();
            const newScore = result.risk_score ?? -1;
            if (newScore > curScore) {
              setReportStarted(true);
              return name;
            }
            return cur;
          });
          break;
        }
        case 'generating_report': {
          setGenerating(true);
          setReportStarted(true);
          setAnalyzing(null);
          break;
        }
        case 'report_token': {
          reportRef.current += (msg.token as string) ?? '';
          if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(flushReport);
          }
          break;
        }
        case 'complete': {
          if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setReportText(reportRef.current);
          setComplete(true);
          setGenerating(false);
          break;
        }
        case 'error': {
          setErrorMsg((msg.message as string) ?? 'Unknown error');
          break;
        }
      }
    },
    [flushReport, userSelected],
  );

  const conn = useWebSocket(handleMessage);

  const stats = useMemo(() => {
    let healthy = 0, atRisk = 0, dying = 0, unresolved = 0;
    for (const p of packages) {
      if (!p.result) { unresolved++; continue; }
      const c = p.result.risk_class;
      if (c === 'Healthy') healthy++;
      else if (c === 'At Risk') atRisk++;
      else if (c === 'Dying') dying++;
      else unresolved++;
    }
    return { healthy, atRisk, dying, unresolved };
  }, [packages]);

  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const analysisStarted = packages.length > 0;

  const handleAnalyze = useCallback(() => {
    if (!fileContent || !fileName) return;
    conn.connect({ content: fileContent, filename: fileName });
  }, [conn, fileContent, fileName]);

  useEffect(() => {
    if (fileName && fileContent && packages.length === 0) handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  // Enter key starts scan after file selected (when scan not yet in progress).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (fileName && fileContent && packages.length === 0) handleAnalyze();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fileName, fileContent, packages.length, handleAnalyze]);

  const handleNewScan = () => {
    conn.close();
    setFileName(null);
    setFileContent('');
    setFilePackages([]);
    setProjectName('');
    setPackages([]);
    setSelected(null);
    setUserSelected(false);
    setAnalyzing(null);
    setProgress({ current: 0, total: 0 });
    setScanStartedAt(null);
    reportRef.current = '';
    setReportText('');
    setReportStarted(false);
    setGenerating(false);
    setComplete(false);
    setErrorMsg(null);
  };

  const selectedPkg = packages.find((p) => p.name === selected);
  const filteredIncidents = selectedPkg?.result?.incidents.filter((i) => i.similarity > 0.3) ?? [];

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: '#070707', color: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <TopBar
        status={conn.status}
        fileName={fileName}
        packageCount={filePackages.length}
        onNewScan={handleNewScan}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <div className="flex flex-1 min-h-0">
        <div
          className="w-[380px] shrink-0 overflow-y-auto p-4 print-hide"
          style={{ background: '#0A0A0A', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          <ManifestUpload
            fileName={fileName}
            packageCount={filePackages.length}
            projectName={projectName}
            onProjectNameChange={setProjectName}
            onFile={(content, name, pkgs) => {
              setFileContent(content);
              setFileName(name);
              setFilePackages(pkgs);
              if (!projectName) setProjectName(name.replace(/\.(txt|json)$/i, ''));
            }}
            onClear={handleNewScan}
          />
          {analysisStarted && (
            <>
              <StatsBar
                healthy={stats.healthy}
                atRisk={stats.atRisk}
                dying={stats.dying}
                unresolved={stats.unresolved}
              />
              {!generating && !complete && (
                <ProgressIndicator
                  current={progress.current}
                  total={progress.total}
                  currentPackage={analyzing}
                  startedAt={scanStartedAt}
                />
              )}
              <PackageGrid
                packages={sortedPackages}
                selected={selected}
                analyzing={analyzing}
                onSelect={(n) => {
                  setSelected(n);
                  setUserSelected(true);
                  setReportStarted(true);
                }}
              />
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 print-report-pane" style={{ background: '#070707' }}>
          {errorMsg && (
            <div
              className="mb-3 px-3 py-2 rounded-full flex items-center justify-between text-[12px] fade-in print-hide"
              style={{ background: 'rgba(232,93,93,0.15)', color: '#E85D5D', border: '1px solid rgba(232,93,93,0.35)' }}
            >
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {!selectedPkg?.result ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="float-soft">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B8E84A" strokeWidth="1.4" style={{ filter: 'drop-shadow(0 0 14px rgba(184,232,74,0.4))' }}>
                  <circle cx="12" cy="12" r="9" />
                  <polygon points="14 10 10 14 12 12" fill="#B8E84A" />
                  <polygon points="14 10 16 8 12 12" />
                </svg>
              </div>
              <div className="text-[13px] mt-4" style={{ color: '#F5F5F5', fontWeight: 500 }}>
                {analysisStarted ? 'Select a package to see its risk analysis' : 'Upload a manifest to begin analysis'}
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: '#5A5A5A' }}>
                requirements.txt · package.json
              </div>
            </div>
          ) : (
            <>
              <PackageHeader name={selectedPkg.name} result={selectedPkg.result} />
              {selectedPkg.result.shap_chart_data.length > 0 && (
                <ShapChart data={selectedPkg.result.shap_chart_data} packageKey={selectedPkg.name} />
              )}
              <div className="mt-3.5">
                <div
                  className="uppercase mb-2"
                  style={{ fontSize: 10, fontWeight: 600, color: '#8A8A8A', letterSpacing: '0.18em' }}
                >
                  Historical Incidents
                </div>
                {filteredIncidents.length > 0 ? (
                  filteredIncidents.slice(0, 3).map((inc, i) => <IncidentCard key={i} incident={inc} />)
                ) : (
                  <div
                    className="rounded-2xl text-[11px] px-4 py-3"
                    style={{
                      background: 'rgba(138,138,138,0.08)',
                      color: '#8A8A8A',
                      border: '1px solid rgba(138,138,138,0.18)',
                    }}
                  >
                    No similar historical incidents found in our postmortem corpus
                  </div>
                )}
              </div>
              <StreamingReport
                text={reportText}
                generating={generating}
                complete={complete}
                packageName={selectedPkg.name}
                started={reportStarted}
                fileName={fileName}
              />
            </>
          )}
        </div>
      </div>

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
