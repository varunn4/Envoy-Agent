import type { RunConfig } from './lead';

export interface RunStats {
  total:    number;
  profiled: number;
  drafted:  number;
  pending:  number;
  sent:     number;
  skipped:  number;
}

export interface RunSummary {
  id:        string;
  startedAt: string;
  endedAt:   string | null;
  config:    RunConfig;
  stats:     RunStats;
  status:    'running' | 'complete' | 'stopped';
  leads?:    import('./lead').Lead[];
}
