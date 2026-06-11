export type RiskClass = 'Healthy' | 'At Risk' | 'Dying' | 'Unknown';

export interface TopSignal {
  feature: string;
  value: number;
  shap_value: number;
  importance: number;
  direction: 'increases' | 'decreases';
  human_readable: string;
}

export interface ShapItem {
  feature: string;
  shap: number;
  value: number;
}

export interface Incident {
  excerpt: string;
  source_url: string;
  similarity: number;
}

export interface PackageResult {
  risk_score: number | null;
  risk_class: RiskClass;
  risk_color: 'green' | 'amber' | 'red' | null;
  confidence: number;
  probabilities: { healthy: number; at_risk: number; dying: number };
  top_signals: TopSignal[];
  shap_chart_data: ShapItem[];
  incidents: Incident[];
  github: string | null;
  error: string | null;
}

export interface WsMessage {
  type:
    | 'start'
    | 'progress'
    | 'package_result'
    | 'generating_report'
    | 'report_token'
    | 'complete'
    | 'error';
  [key: string]: unknown;
}

export interface PackageState {
  name: string;
  loading: boolean;
  result?: PackageResult;
}

// Neon palette from reference dashboard
export const PALETTE = {
  bg: '#070707',
  surface: '#121212',
  surfaceAlt: '#1A1A1A',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: '#F5F5F5',
  textMuted: '#8A8A8A',
  textDim: '#5A5A5A',
  lime: '#B8E84A',
  limeSoft: 'rgba(184,232,74,0.14)',
  orange: '#F59E42',
  orangeSoft: 'rgba(245,158,66,0.14)',
  red: '#E85D5D',
  redSoft: 'rgba(232,93,93,0.14)',
};

export const RISK_COLORS: Record<RiskClass, { text: string; bg: string; border: string; label: string }> = {
  Healthy: { text: PALETTE.lime, bg: PALETTE.limeSoft, border: 'rgba(184,232,74,0.35)', label: 'healthy' },
  'At Risk': { text: PALETTE.orange, bg: PALETTE.orangeSoft, border: 'rgba(245,158,66,0.35)', label: 'at risk' },
  Dying: { text: PALETTE.red, bg: PALETTE.redSoft, border: 'rgba(232,93,93,0.4)', label: 'dying' },
  Unknown: { text: PALETTE.textMuted, bg: 'rgba(138,138,138,0.1)', border: 'rgba(138,138,138,0.2)', label: 'unknown' },
};

export function riskClassFromScore(score: number | null): RiskClass {
  if (score == null) return 'Unknown';
  if (score < 40) return 'Healthy';
  if (score < 70) return 'At Risk';
  return 'Dying';
}
