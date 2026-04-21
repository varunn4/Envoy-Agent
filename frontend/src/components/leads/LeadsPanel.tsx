import type { Lead } from '../../types/lead';
import { LeadCard }   from './LeadCard';
import { EmptyState } from '../shared/EmptyState';

interface LeadsPanelProps {
  leads:     Lead[];
  dryRun:    boolean;
  running:   boolean;
  hasUpload: boolean;
  onApprove: (id: string) => void;
  onRewrite: (id: string, note: string) => void;
  onSkip:    (id: string) => void;
}

export function LeadsPanel({
  leads, dryRun, running, hasUpload,
  onApprove, onRewrite, onSkip,
}: LeadsPanelProps) {
  const emptyTitle = !running && !hasUpload
    ? 'No leads loaded.'
    : 'Waiting for first lead…';
  const emptySub = !running && !hasUpload
    ? 'Upload a CSV file above to begin.'
    : 'Pipeline is initialising — leads will appear here.';

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'visible',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Sub-header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(8,12,20,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 10,
        marginBottom: 4,
        zIndex: 10,
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}>
          Leads This Run
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--blue)' }}>
          {leads.length} leads
        </span>
      </div>

      {leads.length === 0 ? (
        <EmptyState title={emptyTitle} subtitle={emptySub} />
      ) : (
        leads.map((lead, i) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            index={i}
            dryRun={dryRun}
            onApprove={onApprove}
            onRewrite={onRewrite}
            onSkip={onSkip}
          />
        ))
      )}
    </div>
  );
}
