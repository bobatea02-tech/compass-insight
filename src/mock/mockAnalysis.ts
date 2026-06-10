import type { WsMessage, PackageResult } from '@/types/compass';

const mkResult = (overrides: Partial<PackageResult>): PackageResult => ({
  risk_score: 0,
  risk_class: 'Healthy',
  risk_color: 'green',
  confidence: 90,
  probabilities: { healthy: 90, at_risk: 7, dying: 3 },
  top_signals: [],
  shap_chart_data: [],
  incidents: [],
  github: null,
  error: null,
  ...overrides,
});

export const mockPackages: { name: string; result: PackageResult }[] = [
  {
    name: 'fastapi',
    result: mkResult({
      risk_score: 8,
      risk_class: 'Healthy',
      risk_color: 'green',
      confidence: 94.1,
      github: 'tiangolo/fastapi',
      shap_chart_data: [
        { feature: 'Commit frequency trend', shap: -0.38, value: 4.2 },
        { feature: 'Contributor concentration', shap: -0.21, value: 34.0 },
        { feature: 'Release recency', shap: -0.18, value: 12.0 },
      ],
    }),
  },
  {
    name: 'langchain',
    result: mkResult({
      risk_score: 14,
      risk_class: 'Healthy',
      risk_color: 'green',
      confidence: 88.6,
      github: 'langchain-ai/langchain',
      shap_chart_data: [
        { feature: 'Issue response time', shap: -0.29, value: 1.8 },
        { feature: 'Commit frequency trend', shap: -0.24, value: 3.1 },
      ],
    }),
  },
  {
    name: 'httpx',
    result: mkResult({
      risk_score: 11,
      risk_class: 'Healthy',
      risk_color: 'green',
      confidence: 92.0,
      github: 'encode/httpx',
      shap_chart_data: [
        { feature: 'Release recency', shap: -0.22, value: 20.0 },
        { feature: 'Issue response time', shap: -0.18, value: 2.4 },
      ],
    }),
  },
  {
    name: 'core-js',
    result: mkResult({
      risk_score: 61,
      risk_class: 'At Risk',
      risk_color: 'amber',
      confidence: 79.2,
      github: 'zloirock/core-js',
      probabilities: { healthy: 12, at_risk: 79, dying: 9 },
      shap_chart_data: [
        { feature: 'Contributor concentration', shap: 0.41, value: 78.0 },
        { feature: 'Commit frequency trend', shap: 0.28, value: -0.4 },
        { feature: 'Issue response time', shap: 0.19, value: 18.0 },
      ],
    }),
  },
  {
    name: 'left-pad',
    result: mkResult({
      risk_score: 72,
      risk_class: 'Dying',
      risk_color: 'red',
      confidence: 81.0,
      github: 'stevemao/left-pad',
      probabilities: { healthy: 4, at_risk: 15, dying: 81 },
      shap_chart_data: [
        { feature: 'Zero commit weeks', shap: 0.58, value: 0.84 },
        { feature: 'Contributor concentration', shap: 0.43, value: 100.0 },
      ],
      incidents: [
        {
          excerpt:
            'Package unpublished causing widespread breakage across the npm ecosystem in 2016. Thousands of builds failed within hours.',
          source_url: 'https://blog.npmjs.org',
          similarity: 0.81,
        },
      ],
    }),
  },
  {
    name: 'event-stream',
    result: mkResult({
      risk_score: 84,
      risk_class: 'Dying',
      risk_color: 'red',
      confidence: 88.4,
      github: 'dominictarr/event-stream',
      probabilities: { healthy: 3.2, at_risk: 8.4, dying: 88.4 },
      top_signals: [
        {
          feature: 'top_contributor_pct',
          value: 97.2,
          shap_value: 0.621,
          importance: 0.621,
          direction: 'increases',
          human_readable: 'Single contributor makes 97% of all commits',
        },
      ],
      shap_chart_data: [
        { feature: 'Contributor concentration', shap: 0.621, value: 97.2 },
        { feature: 'Commit frequency trend', shap: 0.441, value: -0.82 },
        { feature: 'Sentiment drift', shap: 0.318, value: -0.34 },
        { feature: 'Stale PR ratio', shap: 0.198, value: 0.72 },
        { feature: 'Issue response time', shap: -0.142, value: 2.1 },
        { feature: 'Release recency', shap: -0.089, value: 84.0 },
      ],
      incidents: [
        {
          excerpt:
            'Malicious version published after ownership transfer to an unknown maintainer; payload targeted cryptocurrency wallets.',
          source_url: 'https://blog.npmjs.org/post/180565383195',
          similarity: 0.74,
        },
      ],
    }),
  },
];

export const mockReportTokens = [
  'event-stream',
  ' presents',
  ' critical',
  ' abandonment',
  ' signals.',
  ' The',
  ' single',
  ' maintainer pattern combined with stale PRs strongly resembles prior supply-chain compromises.',
];

export function runMockStream(send: (msg: WsMessage) => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  at(200, () =>
    send({ type: 'start', total: mockPackages.length, packages: mockPackages.map((p) => p.name) }),
  );

  mockPackages.forEach((pkg, i) => {
    const t = 400 + i * 800;
    at(t, () =>
      send({ type: 'progress', package: pkg.name, current: i + 1, total: mockPackages.length }),
    );
    at(t + 300, () => send({ type: 'package_result', package: pkg.name, result: pkg.result }));
  });

  const reportStart = 400 + mockPackages.length * 800 + 500;
  at(reportStart, () =>
    send({ type: 'generating_report', message: 'Generating report...' }),
  );
  mockReportTokens.forEach((token, i) => {
    at(reportStart + 400 + i * 120, () =>
      send({ type: 'report_token', token }),
    );
  });
  at(reportStart + 400 + mockReportTokens.length * 120 + 200, () =>
    send({
      type: 'complete',
      summary: {
        total_analyzed: mockPackages.length,
        healthy: 3,
        at_risk: 1,
        dying: 2,
        analysis_id: 'mock-' + Math.random().toString(36).slice(2, 10),
      },
    }),
  );

  return () => timers.forEach(clearTimeout);
}
