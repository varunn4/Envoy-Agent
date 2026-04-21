import { ControlsBar } from '../components/layout/ControlsBar';
import { StatsRow }    from '../components/layout/StatsRow';
import { LeadsPanel }  from '../components/leads/LeadsPanel';
import { LogPanel }    from '../components/log/LogPanel';
import type { Lead, RunConfig } from '../types/lead';
import type { LogEntry }        from '../types/log';
import type { RunStats }        from '../types/run';
import type { UploadedFile }    from '../hooks/useRunState';

interface DashboardProps {
  running:             boolean;
  leads:               Lead[];
  logs:                LogEntry[];
  stats:               RunStats;
  dryRun:              boolean;
  uploadedFile:        UploadedFile | null;
  defaultCsvAvailable: boolean;
  uploading:           boolean;
  onStart:             (config: RunConfig) => void;
  onStop:              () => void;
  onClear:             () => void;
  onApprove:           (id: string) => void;
  onRewrite:           (id: string, note: string) => void;
  onSkip:              (id: string) => void;
  onUpload:            (file: File) => void;
  onClearUpload:       () => void;
}

export function Dashboard({
  running, leads, logs, stats, dryRun,
  uploadedFile, defaultCsvAvailable, uploading,
  onStart, onStop, onClear, onApprove, onRewrite, onSkip,
  onUpload, onClearUpload,
}: DashboardProps) {
  return (
    <>
      <ControlsBar
        running={running}
        leadsCount={leads.length}
        uploadedFile={uploadedFile}
        defaultCsvAvailable={defaultCsvAvailable}
        onStart={onStart}
        onStop={onStop}
        onClear={onClear}
        onUpload={onUpload}
        onClearUpload={onClearUpload}
        uploading={uploading}
      />
      <StatsRow stats={stats} />

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        overflow: 'hidden',
      }}>
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LeadsPanel
            leads={leads}
            dryRun={dryRun}
            running={running}
            hasUpload={!!uploadedFile || defaultCsvAvailable}
            onApprove={onApprove}
            onRewrite={onRewrite}
            onSkip={onSkip}
          />
        </div>
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LogPanel logs={logs} />
        </div>
      </div>
    </>
  );
}
