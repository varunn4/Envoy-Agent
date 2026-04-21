import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;

// ── Config ────────────────────────────────────────────────────────────────────

export interface BackendConfig {
  sender: {
    name:       string;
    company:    string;
    role:       string;
    value_prop: string;
    tone:       string;
    cta:        string;
    signature:  string;
  };
  icp: {
    titles:           string[];
    industries:       string[];
    company_size:     { min: number; max: number };
    exclude_domains:  string[];
  };
  run: {
    leads_per_run:        number;
    fit_score_threshold:  number;
    dry_run:              boolean;
    leads_source:         string;
    csv_path:             string;
  };
  claude: {
    model:               string;
    fit_score_threshold: number;
  };
}

export async function fetchConfig(): Promise<BackendConfig> {
  const { data } = await api.get<BackendConfig>('/config');
  return data;
}

export async function saveConfig(patch: Partial<BackendConfig>): Promise<BackendConfig> {
  const { data } = await api.post<{ ok: boolean; config: BackendConfig }>('/config', patch);
  return data.config;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export async function fetchPrompt(name: 'profile' | 'email'): Promise<string> {
  const { data } = await api.get<{ name: string; text: string }>(`/prompts/${name}`);
  return data.text;
}

export async function savePrompt(name: 'profile' | 'email', text: string): Promise<void> {
  await api.post(`/prompts/${name}`, { text });
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function fetchRuns() {
  const { data } = await api.get('/runs');
  return data;
}

export async function fetchRunLeads(runId: string) {
  const { data } = await api.get(`/runs/${runId}/leads`);
  return data;
}

export async function fetchRunLogs(runId: string) {
  const { data } = await api.get(`/runs/${runId}/logs`);
  return data;
}

export async function fetchCurrentRun() {
  const { data } = await api.get('/run/current');
  return data;
}

// ── Leads Upload ──────────────────────────────────────────────────────────────

export interface UploadStatus {
  uploaded:    boolean;
  defaultCsv:  boolean;
  count:       number;
  fileName:    string | null;
  uploadedAt?: string;
  parseErrors?: string[];
  preview?:    { name: string; email: string; company: string }[];
}

export interface UploadResult {
  ok:          boolean;
  count:       number;
  fileName:    string;
  parseErrors: string[];
  preview:     { name: string; email: string; company: string }[];
}

export async function fetchLeadsStatus(): Promise<UploadStatus> {
  const { data } = await api.get<UploadStatus>('/leads/upload');
  return data;
}

export async function uploadLeadsCSV(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<UploadResult>('/leads/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function clearUploadedLeads(): Promise<void> {
  await api.delete('/leads/upload');
}

// ── Actions (Approve & Send) ──────────────────────────────────────────────────

/**
 * Approve a drafted lead and send its email via Gmail/SMTP.
 * Hits POST /api/action/send. Backend enforces status=drafted and dry_run safety.
 */
export async function approveAndSendLead(leadId: string): Promise<void> {
  await api.post('/action/send', { leadId });
}
