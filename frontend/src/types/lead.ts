export type LeadStatus =
  | 'queued'
  | 'pulling'
  | 'scraping'
  | 'profiling'
  | 'drafting'
  | 'drafted'
  | 'pending'
  | 'approved'
  | 'sent'
  | 'skipped'
  | 'low-fit'
  | 'send_failed'
  | 'rewriting';

export interface Lead {
  id:                    string;
  apolloId:              string;
  name:                  string;
  firstName:             string;
  title:                 string;
  company:               string;
  email:                 string;
  linkedinUrl:           string;
  website:               string;
  industry:              string;
  companySize:           number;
  region:                string;
  status:                LeadStatus;
  fitScore:              number | null;
  fitReason:             string | null;
  painPoints:            string[];
  recentSignal:          string | null;
  hook:                  string | null;
  draftSubject:          string | null;
  draftBody:             string | null;
  editableDraftSubject?: string | null;
  editableDraftBody?:    string | null;
  progress:              number;
  stepLabel:             string;
  createdAt:             string;
  sentAt:                string | null;
}

export interface RunConfig {
  region:     string;
  industry:   string;
  leadsCount: number;
  dryRun:     boolean;
}
