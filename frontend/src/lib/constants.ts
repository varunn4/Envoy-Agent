import type { LeadStatus } from '../types/lead';
import type { LogLevel } from '../types/log';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  queued:       'Queued',
  pulling:      'Pulling',
  scraping:     'Scraping',
  profiling:    'Profiling',
  drafting:     'Drafting',
  drafted:      'Drafted',
  pending:      'Pending Approval',
  approved:     'Approved',
  sent:         'Sent',
  skipped:      'Skipped',
  'low-fit':    'Low Fit',
  'send_failed':'Send Failed',
  rewriting:    'Rewriting',
};

export const STATUS_ACCENT: Record<LeadStatus, string> = {
  queued:       '#334155',
  pulling:      '#334155',
  scraping:     'var(--sky)',
  profiling:    'var(--blue)',
  drafting:     'var(--violet)',
  drafted:      '#A855F7',
  pending:      'var(--amber)',
  approved:     'var(--green)',
  sent:         'var(--green)',
  skipped:      '#334155',
  'low-fit':    'var(--red)',
  'send_failed':'var(--red)',
  rewriting:    'var(--violet)',
};

export const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string; border: string }> = {
  queued:       { bg: '#1C2A3E',                      color: 'var(--t3)',     border: 'var(--border)' },
  pulling:      { bg: '#1C2A3E',                      color: 'var(--t3)',     border: 'var(--border)' },
  scraping:     { bg: 'rgba(56,189,248,0.1)',          color: 'var(--sky)',    border: 'rgba(56,189,248,0.2)' },
  profiling:    { bg: 'var(--blue-dim)',               color: '#93C5FD',       border: 'rgba(37,99,235,0.2)' },
  drafting:     { bg: 'rgba(129,140,248,0.1)',         color: 'var(--violet)', border: 'rgba(129,140,248,0.2)' },
  drafted:      { bg: 'rgba(168,85,247,0.14)',         color: '#C084FC',       border: 'rgba(168,85,247,0.35)' },
  pending:      { bg: 'var(--amber-dim)',              color: 'var(--amber)',  border: 'rgba(245,158,11,0.25)' },
  approved:     { bg: 'var(--green-dim)',              color: 'var(--green)',  border: 'rgba(16,185,129,0.25)' },
  sent:         { bg: 'var(--green-dim)',              color: 'var(--green)',  border: 'rgba(16,185,129,0.25)' },
  skipped:      { bg: 'rgba(71,85,105,0.1)',           color: 'var(--t3)',     border: 'var(--border)' },
  'low-fit':    { bg: 'var(--red-dim)',                color: 'var(--red)',    border: 'rgba(239,68,68,0.2)' },
  'send_failed':{ bg: 'var(--red-dim)',                color: 'var(--red)',    border: 'rgba(239,68,68,0.2)' },
  rewriting:    { bg: 'rgba(129,140,248,0.1)',         color: 'var(--violet)', border: 'rgba(129,140,248,0.2)' },
};

export const SPINNING_STATUSES: LeadStatus[] = ['pulling', 'scraping', 'profiling', 'drafting', 'rewriting'];

export const TERMINAL_STATUSES: LeadStatus[] = ['sent', 'skipped', 'low-fit', 'send_failed'];

export const LOG_ICONS: Record<LogLevel, string> = {
  info:    '▶',
  success: '✓',
  warn:    '▲',
  error:   '✕',
  system:  '\u2014',
};

export const REGION_MAP: Record<string, string> = {
  'Bangalore': 'BLR',
  'UAE':       'UAE',
  'GCC':       'GCC',
  'Mumbai':    'BOM',
  'Delhi':     'DEL',
  'Singapore': 'SIN',
};

export const INDUSTRIES = ['All', 'Fintech', 'Healthtech', 'SaaS', 'BFSI', 'EdTech'];

export const LEADS_OPTIONS = [5, 10, 20];

export const STEP_LABELS = {
  queued:      'Waiting in queue...',
  pulling:     'Pulling from Apollo...',
  scraping:    'Scraping LinkedIn + website...',
  profiling:   'Profiling with Claude...',
  drafting:    'Drafting email...',
  drafted:     'Draft ready \u2014 awaiting approval',
  pending:     'Draft ready \u2014 awaiting approval',
  approved:    'Approved',
  sent:        'Email sent successfully',
  skipped:     'Skipped by user',
  'low-fit':   'Low fit \u2014 skipped',
  'send_failed': 'Send failed',
  rewriting:   'Rewriting draft...',
};

export const BUTTON_LABELS = {
  startRun:    'Start Run',
  stopRun:     'Stop',
  clearLeads:  'Clear',
  approve:     'Approve & Send',
  rewrite:     'Rewrite',
  skip:        'Skip',
  showMore:    'Show more',
  showLess:    'Show less',
  reconnect:   'Reconnect',
  testConn:    'Test Connection',
  testWebhook: 'Test Webhook',
  save:        'Save',
};

export const SOCKET_URL = 'http://localhost:3001';
