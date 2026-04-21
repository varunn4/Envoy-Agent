import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lead } from '../../types/lead';
import { STATUS_ACCENT, TERMINAL_STATUSES, STATUS_LABELS } from '../../lib/constants';
import { StatusBadge } from '../shared/Badge';
import { ProgressBar } from '../shared/ProgressBar';
import { ApprovalBanner } from './ApprovalBanner';
import { approveAndSendLead } from '../../lib/api';

interface LeadCardProps {
  lead:      Lead;
  index:     number;
  dryRun:    boolean;
  onApprove: (id: string) => void;
  onRewrite: (id: string, note: string) => void;
  onSkip:    (id: string) => void;
}


// Stage chip with blinking dot for active stages
function StagePill({ status }: { status: Lead['status'] }) {
  const accentColor = STATUS_ACCENT[status];
  const isDone = TERMINAL_STATUSES.includes(status);
  const isActive = !isDone && status !== 'queued' && status !== 'pending' && status !== 'drafted';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 9, letterSpacing: '0.6px', textTransform: 'uppercase',
      color: accentColor, opacity: 0.9,
    }}>
      <span
        className={isActive ? 'step-pulse' : ''}
        style={{
          width: 5, height: 5, borderRadius: '50%',
          background: accentColor, flexShrink: 0,
        }}
      />
      {STATUS_LABELS[status]}
    </div>
  );
}

function MetaRow({ lead }: { lead: Lead }) {
  return (
    <div style={{
      display: 'flex', gap: 14,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10, color: 'var(--t3)',
      marginTop: 6, flexWrap: 'wrap',
    }}>
      {lead.email && <span>✉ {lead.email}</span>}
      {lead.industry && <span>◈ {lead.industry}</span>}
      {lead.companySize ? <span>◎ {lead.companySize} people</span> : null}
    </div>
  );
}

// ── Review draft UI panel ───────────────────────────────────────────────────
interface ReviewPanelProps {
  draftBody: string;
  onBodyChange: (value: string) => void;
  onSend: (e: React.MouseEvent) => void;
  onReject: (e: React.MouseEvent) => void;
  sending: boolean;
  rejecting: boolean;
  dryRun: boolean;
}

function ReviewPanel({ draftBody, onBodyChange, onSend, onReject, sending, rejecting, dryRun }: ReviewPanelProps) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--sky)',
      borderRadius: 'var(--radius-sm)',
      minHeight: 120,
      padding: 16,
      overflow: 'visible',
    }}>
      <textarea
        value={draftBody}
        onChange={(e) => onBodyChange(e.target.value)}
        style={{
          width: '100%',
          fontSize: 14,
          color: '#fff',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: 12,
          minHeight: 120,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'DM Sans, sans-serif',
          lineHeight: 1.6,
        }}
      />

      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginTop: 12,
      }}>
        <motion.button
          whileHover={!dryRun && !sending ? { scale: 1.02 } : {}}
          whileTap={!dryRun && !sending ? { scale: 0.97 } : {}}
          onClick={onSend}
          disabled={dryRun || sending}
          style={{
            background: dryRun ? 'rgba(71,85,105,0.15)' : 'rgba(16,185,129,0.18)',
            color: dryRun ? 'var(--t3)' : 'var(--green)',
            border: '1px solid rgba(16,185,129,0.35)',
            boxShadow: dryRun ? 'none' : '0 0 18px rgba(16,185,129,0.2)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            cursor: dryRun ? 'not-allowed' : (sending ? 'wait' : 'pointer'),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: sending ? 0.72 : 1,
          }}
        >
          {sending ? 'Sending...' : 'Accept & Send'}
        </motion.button>

        <motion.button
          whileHover={!rejecting ? { scale: 1.02 } : {}}
          whileTap={!rejecting ? { scale: 0.97 } : {}}
          onClick={onReject}
          disabled={rejecting}
          style={{
            background: 'transparent',
            color: 'var(--red)',
            border: '1px solid rgba(239,68,68,0.35)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            cursor: rejecting ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: rejecting ? 0.72 : 1,
          }}
        >
          {rejecting ? 'Rejecting...' : 'Reject'}
        </motion.button>
      </div>
    </div>
  );
}

export function LeadCard({ lead, index, dryRun, onApprove, onRewrite, onSkip }: LeadCardProps) {
  const [reviewOpen,    setReviewOpen]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [sendError,     setSendError]     = useState<string | null>(null);
  const [draftText,     setDraftText]     = useState(lead.editableDraftBody || lead.draftBody || '');

  useEffect(() => {
    setDraftText(lead.editableDraftBody || lead.draftBody || '');
  }, [lead.id, lead.draftBody, lead.editableDraftBody]);

  const isSent      = lead.status === 'sent';
  const isPending   = lead.status === 'pending' || lead.status === 'rewriting';
  const isDrafted   = lead.status === 'drafted';
  const isDone      = TERMINAL_STATUSES.includes(lead.status);
  const hasDraft    = !!lead.draftBody || !!lead.draftSubject;

  let cardBorder = '1px solid var(--border)';
  let cardShadow = 'none';

  if (isPending) {
    cardBorder = '1px solid rgba(245,158,11,0.3)';
    cardShadow = '0 0 24px rgba(245,158,11,0.06), inset 0 0 40px rgba(245,158,11,0.02)';
  } else if (isDrafted) {
    cardBorder = '1px solid rgba(168,85,247,0.3)';
    cardShadow = '0 0 24px rgba(168,85,247,0.07), inset 0 0 40px rgba(168,85,247,0.02)';
  } else if (isSent) {
    cardBorder = '1px solid rgba(16,185,129,0.2)';
  } else if (lead.status === 'low-fit' || lead.status === 'send_failed') {
    cardBorder = '1px solid rgba(239,68,68,0.15)';
  }

  const handleApproveSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dryRun || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await approveAndSendLead(lead.id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
        ?? 'Send failed';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rejecting) return;
    setRejecting(true);
    try {
      onSkip(lead.id);
    } finally {
      setRejecting(false);
    }
  };

  const showDraftReview = hasDraft || isDrafted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isSent ? 0.82 : 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        background: 'var(--card)',
        border: cardBorder,
        borderRadius: 'var(--radius)',
        padding: 24,
        minHeight: 180,
        position: 'relative',
        overflow: 'visible',
        boxShadow: cardShadow,
        cursor: 'default',
        transition: 'box-shadow 0.2s, border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 16,
        right: 20,
        zIndex: 2,
      }}>
        <StatusBadge status={lead.status} />
      </div>

      {dryRun && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 20,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: 'var(--amber)',
          border: '1px solid rgba(245,158,11,0.3)',
          padding: '2px 6px',
          borderRadius: 4,
          opacity: 0.7,
          zIndex: 2,
        }}>DRY</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--t1)',
          margin: 0,
          lineHeight: 1.2,
          wordBreak: 'break-word',
        }}>
          {lead.name}
        </p>

        <p style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          color: 'var(--t2)',
          margin: 0,
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}>
          {lead.title} · <span style={{ color: 'var(--sky)', fontWeight: 500 }}>{lead.company}</span>
        </p>

        <StagePill status={lead.status} />
      </div>

      <MetaRow lead={lead} />

      <ProgressBar progress={lead.progress} status={lead.status} />

      {lead.stepLabel && (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: isDone && isSent ? 'var(--green)' : (isDrafted ? '#C084FC' : 'var(--t3)'),
          lineHeight: 1.4,
        }}>
          {isDone && isSent ? `✓ ${lead.stepLabel}` : lead.stepLabel}
        </span>
      )}

      {showDraftReview && (
        <div>
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setReviewOpen((prev) => !prev);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: 'rgba(37,99,235,0.14)',
              color: 'var(--sky)',
              border: '1px solid var(--sky)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {reviewOpen ? 'Hide Review Draft' : 'Review Draft'}
          </motion.button>
        </div>
      )}

      {reviewOpen && showDraftReview && (
        <div style={{ overflow: 'visible' }}>
          <ReviewPanel
            draftBody={draftText}
            onBodyChange={setDraftText}
            onSend={handleApproveSend}
            onReject={handleReject}
            sending={sending}
            rejecting={rejecting}
            dryRun={dryRun}
          />

          {sendError && !dryRun && (
            <div style={{
              marginTop: 12,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'var(--red)',
            }}>
              ✕ {sendError}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isPending && (
          <ApprovalBanner
            lead={lead}
            onApprove={onApprove}
            onRewrite={onRewrite}
            onSkip={onSkip}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
