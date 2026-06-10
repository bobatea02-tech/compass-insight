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

export const RISK_COLORS: Record<RiskClass, { text: string; bg: string; border: string; label: string }> = {
  Healthy: { text: '#00C8C8', bg: 'rgba(0,200,200,0.1)', border: 'rgba(0,200,200,0.2)', label: 'healthy' },
  'At Risk': { text: '#FFB020', bg: 'rgba(255,176,32,0.1)', border: 'rgba(255,176,32,0.2)', label: 'at risk' },
  Dying: { text: '#FF3535', bg: 'rgba(255,53,53,0.1)', border: 'rgba(255,53,53,0.25)', label: 'dying' },
  Unknown: { text: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)', label: 'unknown' },
};

export function riskClassFromScore(score: number | null): RiskClass {
  if (score == null) return 'Unknown';
  if (score < 40) return 'Healthy';
  if (score < 70) return 'At Risk';
  return 'Dying';
}
