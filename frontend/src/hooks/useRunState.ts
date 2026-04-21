import { useCallback, useReducer } from 'react';
import type { Lead, RunConfig } from '../types/lead';
import type { LogEntry } from '../types/log';
import type { RunStats } from '../types/run';

export interface UploadedFile {
  name:        string;
  count:       number;
  parseErrors: string[];
  preview:     { name: string; email: string; company: string }[];
}

interface RunState {
  running:      boolean;
  runId:        string | null;
  leads:        Lead[];
  logs:         LogEntry[];
  stats:        RunStats;
  config:       RunConfig;
  uploadedFile: UploadedFile | null;
}

type RunAction =
  | { type: 'RUN_STARTED';   runId: string; config: RunConfig }
  | { type: 'RUN_RECONNECT'; runId: string; config: RunConfig }
  | { type: 'RUN_STOPPED' }
  | { type: 'RUN_COMPLETE' }
  | { type: 'LEAD_ADDED';    lead: Lead }
  | { type: 'LEAD_UPDATED';  update: Partial<Lead> & { id: string } }
  | { type: 'LOG_ADDED';     entry: LogEntry }
  | { type: 'STATS_UPDATED'; stats: RunStats }
  | { type: 'CLEAR_LEADS' }
  | { type: 'SET_UPLOAD';    file: UploadedFile }
  | { type: 'CLEAR_UPLOAD' };

const initialStats: RunStats = { total: 0, profiled: 0, drafted: 0, pending: 0, sent: 0, skipped: 0 };
const defaultConfig: RunConfig = { region: 'Bangalore', industry: 'All', leadsCount: 10, dryRun: false };

const initialState: RunState = {
  running:      false,
  runId:        null,
  leads:        [],
  logs:         [],
  stats:        { ...initialStats },
  config:       { ...defaultConfig },
  uploadedFile: null,
};

function reducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'RUN_STARTED':
      return {
        ...state,
        running:      true,
        runId:        action.runId,
        leads:        [],
        logs:         [],
        stats:        { ...initialStats },
        config:       action.config,
        uploadedFile: null,
      };
    case 'RUN_RECONNECT':
      return { ...state, running: true, runId: action.runId, config: action.config };
    case 'RUN_STOPPED':
    case 'RUN_COMPLETE':
      return { ...state, running: false };
    case 'LEAD_ADDED':
      if (state.leads.some(l => l.id === action.lead.id)) {
        return {
          ...state,
          leads: state.leads.map(l => l.id === action.lead.id ? { ...l, ...action.lead } : l),
        };
      }
      return { ...state, leads: [...state.leads, action.lead] };
    case 'LEAD_UPDATED':
      return {
        ...state,
        leads: state.leads.map(l =>
          l.id === action.update.id ? { ...l, ...action.update } : l
        ),
      };
    case 'LOG_ADDED':
      if (state.logs.some(e => e.id === action.entry.id)) return state;
      return { ...state, logs: [...state.logs, action.entry] };
    case 'STATS_UPDATED':
      return { ...state, stats: action.stats };
    case 'CLEAR_LEADS':
      return { ...state, leads: [], logs: [], stats: { ...initialStats } };
    case 'SET_UPLOAD':
      return { ...state, uploadedFile: action.file };
    case 'CLEAR_UPLOAD':
      return { ...state, uploadedFile: null };
    default:
      return state;
  }
}

export function useRunState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startRun     = useCallback((runId: string, config: RunConfig) =>
    dispatch({ type: 'RUN_STARTED', runId, config }), []);
  const reconnectRun = useCallback((runId: string, config: RunConfig) =>
    dispatch({ type: 'RUN_RECONNECT', runId, config }), []);
  const stopRun      = useCallback(() => dispatch({ type: 'RUN_STOPPED' }), []);
  const completeRun  = useCallback(() => dispatch({ type: 'RUN_COMPLETE' }), []);
  const addLead      = useCallback((lead: Lead) => dispatch({ type: 'LEAD_ADDED', lead }), []);
  const updateLead   = useCallback((update: Partial<Lead> & { id: string }) =>
    dispatch({ type: 'LEAD_UPDATED', update }), []);
  const addLog       = useCallback((entry: LogEntry) => dispatch({ type: 'LOG_ADDED', entry }), []);
  const updateStats  = useCallback((stats: RunStats) => dispatch({ type: 'STATS_UPDATED', stats }), []);
  const clearLeads   = useCallback(() => dispatch({ type: 'CLEAR_LEADS' }), []);
  const setUpload    = useCallback((file: UploadedFile) => dispatch({ type: 'SET_UPLOAD', file }), []);
  const clearUpload  = useCallback(() => dispatch({ type: 'CLEAR_UPLOAD' }), []);

  return {
    ...state,
    startRun,
    reconnectRun,
    stopRun,
    completeRun,
    addLead,
    updateLead,
    addLog,
    updateStats,
    clearLeads,
    setUpload,
    clearUpload,
  };
}
