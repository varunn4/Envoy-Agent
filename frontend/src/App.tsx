import { useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Topbar }          from './components/layout/Topbar';
import { BottomBar }       from './components/layout/BottomBar';
import { ToastContainer }  from './components/shared/Toast';
import { Dashboard }       from './views/Dashboard';
import { History }         from './views/History';
import { Settings }        from './views/Settings';
import { useRunState }     from './hooks/useRunState';
import { useSocket }       from './hooks/useSocket';
import { useToast }        from './hooks/useToast';
import type { RunConfig }  from './types/lead';
import type { Lead }       from './types/lead';
import type { RunStats }   from './types/run';
import {
  fetchCurrentRun, fetchRunLogs, fetchLeadsStatus,
  uploadLeadsCSV, clearUploadedLeads,
} from './lib/api';

function buildRunConfigFromSnapshot(configSnapshot: unknown): RunConfig {
  let parsed: Record<string, unknown> = {};
  try {
    if (typeof configSnapshot === 'string') {
      parsed = JSON.parse(configSnapshot) as Record<string, unknown>;
    } else if (configSnapshot && typeof configSnapshot === 'object') {
      parsed = configSnapshot as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }
  const run = (parsed.run as Record<string, unknown>) || {};
  return {
    region:     (parsed.region as string) || '',
    industry:   (parsed.industry as string) || 'All',
    leadsCount: (run.leads_per_run as number) || 10,
    dryRun:     (run.dry_run as boolean) || false,
  };
}

function deriveStatsFromLeads(leads: Lead[]): RunStats {
  return {
    total:    leads.length,
    profiled: leads.filter(l => l.fitScore !== null && l.fitScore !== undefined).length,
    drafted:  leads.filter(l => !!l.draftSubject).length,
    pending:  leads.filter(l => l.status === 'pending').length,
    sent:     leads.filter(l => l.status === 'sent').length,
    skipped:  leads.filter(l => l.status === 'skipped' || l.status === 'low-fit').length,
  };
}

export function App() {
  const location = useLocation();
  const {
    running, leads, logs, stats, config, uploadedFile,
    startRun, reconnectRun, stopRun, completeRun,
    addLead, updateLead, addLog, updateStats, clearLeads,
    setUpload, clearUpload,
  } = useRunState();

  const { toasts, addToast, removeToast } = useToast();

  // Upload flow state
  const [uploading,           setUploading]           = useState(false);
  const [defaultCsvAvailable, setDefaultCsvAvailable] = useState(true); // optimistic

  // Check backend for upload/default CSV status on mount
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    fetchLeadsStatus()
      .then(status => {
        setDefaultCsvAvailable(status.defaultCsv);
        if (status.uploaded && status.fileName && status.count) {
          setUpload({
            name:        status.fileName,
            count:       status.count,
            parseErrors: status.parseErrors ?? [],
            preview:     status.preview ?? [],
          });
          addToast(`Previous upload restored: ${status.count} leads`, '📋');
        }
      })
      .catch(() => {
        // Non-critical; default CSV assumed available
      });
  }, [setUpload, addToast]);

  const {
    startRun: socketStart, stopRun: socketStop,
    approveLead, skipLead, rewriteLead,
  } = useSocket({
    isRunning: running,

    onRunStarted: (incomingRunId, cfg, isReconnect) => {
      if (isReconnect) {
        reconnectRun(incomingRunId, cfg);
      } else {
        startRun(incomingRunId, cfg);
      }
    },

    onRunStopped:       stopRun,
    onRunComplete:      completeRun,
    onLeadAdded:        addLead,
    onLeadUpdated:      updateLead,
    onLogEntry:         addLog,
    onStatsUpdated:     updateStats,
    onApprovalRequired: (_leadId) => {},
    addToast,
  });

  // On mount — reconnect to any running pipeline
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromBackend() {
      try {
        const current = await fetchCurrentRun();
        if (cancelled || current?.status !== 'running' || !current?.id) return;

        const cfg = buildRunConfigFromSnapshot(current.config_snapshot);
        reconnectRun(current.id, cfg);

        const hydratedLeads: Lead[] = Array.isArray(current.leads) ? current.leads : [];
        hydratedLeads.forEach(addLead);
        updateStats(deriveStatsFromLeads(hydratedLeads));

        const fetchedLogs = await fetchRunLogs(current.id);
        if (cancelled || !Array.isArray(fetchedLogs)) return;
        fetchedLogs.forEach(addLog);
      } catch {
        // Socket hydration is the live fallback
      }
    }

    hydrateFromBackend();
    return () => { cancelled = true; };
  }, [addLead, addLog, reconnectRun, updateStats]);

  // ── Upload handler ────────────────────────────────────────────────────────

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadLeadsCSV(file);
      setUpload({
        name:        result.fileName,
        count:       result.count,
        parseErrors: result.parseErrors,
        preview:     result.preview,
      });

      if (result.parseErrors.length > 0) {
        addToast(
          `Uploaded ${result.count} leads (${result.parseErrors.length} rows skipped)`,
          '⚠'
        );
      } else {
        addToast(`Uploaded ${result.count} leads from ${result.fileName}`, '✓');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
        ?? 'Upload failed';
      addToast(`Upload failed: ${msg}`, '✕');
    } finally {
      setUploading(false);
    }
  };

  const handleClearUpload = async () => {
    try {
      await clearUploadedLeads();
      clearUpload();
      addToast('Uploaded leads cleared', '○');
    } catch {
      clearUpload(); // Clear UI state regardless
    }
  };

  // ── Run handlers ──────────────────────────────────────────────────────────

  const handleStart = (cfg: RunConfig) => socketStart(cfg);

  const handleStop = () => {
    socketStop();
    stopRun();
  };

  const pendingCount = leads.filter(l => l.status === 'pending').length;

  return (
    <div className="app-shell">
      <Topbar running={running} pendingCount={pendingCount} />

      <div className="app-main">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <Dashboard
                  running={running}
                  leads={leads}
                  logs={logs}
                  stats={stats}
                  dryRun={config.dryRun}
                  uploadedFile={uploadedFile}
                  defaultCsvAvailable={defaultCsvAvailable}
                  uploading={uploading}
                  onStart={handleStart}
                  onStop={handleStop}
                  onClear={clearLeads}
                  onApprove={approveLead}
                  onRewrite={rewriteLead}
                  onSkip={skipLead}
                  onUpload={handleUpload}
                  onClearUpload={handleClearUpload}
                />
              }
            />
            <Route path="/history"  element={<History  />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </div>

      <BottomBar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
