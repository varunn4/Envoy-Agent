import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import type { Lead, RunConfig } from '../types/lead';
import type { LogEntry } from '../types/log';
import type { RunStats } from '../types/run';

interface UseSocketProps {
  onRunStarted:        (runId: string, config: RunConfig, isReconnect: boolean) => void;
  onRunStopped:        () => void;
  onRunComplete:       () => void;
  onLeadAdded:         (lead: Lead) => void;
  onLeadUpdated:       (update: Partial<Lead> & { id: string }) => void;
  onLogEntry:          (entry: LogEntry) => void;
  onStatsUpdated:      (stats: RunStats) => void;
  onApprovalRequired:  (leadId: string) => void;
  addToast:            (message: string, icon?: string) => void;
  isRunning:           boolean;
}

// Extract a RunConfig-shaped object from the backend run:started payload.
// Backend emits { runId, config } where config is the full pipeline config (snake_case).
function extractRunConfig(payload: Record<string, unknown>): RunConfig {
  const cfg = (payload.config as Record<string, unknown>) || {};
  const run = (cfg.run as Record<string, unknown>) || {};
  return {
    region:     (cfg.region as string)     || '',
    industry:   (cfg.industry as string)   || 'All',
    leadsCount: (run.leads_per_run as number) || 10,
    dryRun:     (run.dry_run as boolean)   || false,
  };
}

export function useSocket(props: UseSocketProps) {
  const socketRef  = useRef(getSocket());
  const propsRef   = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const socket = socketRef.current;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (...args: any[]) => void> = {

      'run:started': (d: unknown) => {
        const payload   = d as Record<string, unknown>;
        const runId     = (payload.runId as string) || '';
        const config    = extractRunConfig(payload);
        // If already running when we receive this, it's a reconnect hydration
        const reconnect = propsRef.current.isRunning;
        propsRef.current.onRunStarted(runId, config, reconnect);
      },

      'run:stopped':  () => propsRef.current.onRunStopped(),

      'run:complete': () => {
        propsRef.current.onRunComplete();
        propsRef.current.addToast('Run complete', '✓');
      },

      'lead:added':   (d: unknown) => propsRef.current.onLeadAdded(d as Lead),
      'lead:updated': (d: unknown) => propsRef.current.onLeadUpdated(d as Partial<Lead> & { id: string }),
      'log:entry':    (d: unknown) => propsRef.current.onLogEntry(d as LogEntry),
      'stats:updated':(d: unknown) => propsRef.current.onStatsUpdated(d as RunStats),

      'approval:required': (d: unknown) => {
        const leadId = (d as { leadId: string }).leadId;
        propsRef.current.onApprovalRequired(leadId);
        propsRef.current.addToast('Draft ready — approval required', '▲');
      },

      'connect':    () => propsRef.current.addToast('Connected to server', '●'),
      'disconnect': () => propsRef.current.addToast('Disconnected — retrying…', '○'),

      'error': (err: unknown) => {
        const msg = (err as { message?: string })?.message || 'Socket error';
        propsRef.current.addToast(msg, '✕');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    };
  }, []);

  const startRun  = (config: RunConfig) => socketRef.current.emit('run:start', config);
  const stopRun   = ()                  => socketRef.current.emit('run:stop');
  const approveLead = (leadId: string)  => socketRef.current.emit('action:approve', { leadId });
  const skipLead    = (leadId: string)  => socketRef.current.emit('action:skip',    { leadId });
  const rewriteLead = (leadId: string, note = '') =>
    socketRef.current.emit('action:rewrite', { leadId, note });

  return { startRun, stopRun, approveLead, skipLead, rewriteLead };
}
