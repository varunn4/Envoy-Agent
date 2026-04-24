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
  onClose: () => void;
  sending: boolean;
  dryRun: boolean;
  isOverlay?: boolean;
  sendError?: string | null;
}

function ReviewPanel({ draftBody, onBodyChange, onSend, onReject, onClose, sending, dryRun, isOverlay = false, sendError }: ReviewPanelProps) {
  const panelStyle = isOverlay ? {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(13, 17, 23, 0.95)',
    backdropFilter: 'blur(8px)',
    zIndex: 50,
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } : {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,209,255,0.3)',
    borderRadius: '8px',
    minHeight: 100,
    padding: 16,
    overflow: 'visible',
    marginBottom: 12,
  };

  return (
    <div style={panelStyle} data-testid="review-overlay">
      {isOverlay && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            color: 'var(--t3)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
          }}
        >
          ✕
        </button>
      )}

      <textarea
        value={draftBody}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Edit email draft..."
        style={{
          width: '100%',
          height: isOverlay ? '60%' : 'auto',
          fontSize: 14,
          color: '#fff',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0,209,255,0.2)',
          borderRadius: 8,
          padding: 12,
          minHeight: isOverlay ? 'auto' : 100,
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
        width: '100%',
        justifyContent: isOverlay ? 'center' : 'flex-start',
      }}>
        <motion.button
          whileHover={!dryRun && !sending ? { scale: 1.02 } : {}}
          whileTap={!dryRun && !sending ? { scale: 0.97 } : {}}
          onClick={onSend}
          disabled={dryRun || sending}
          style={{
            background: dryRun ? 'rgba(71,85,105,0.15)' : 'rgba(16,185,129,0.25)',
            color: dryRun ? 'var(--t3)' : 'var(--green)',
            border: '1.5px solid' + (dryRun ? ' rgba(71,85,105,0.3)' : ' rgba(16,185,129,0.6)'),
            boxShadow: dryRun ? 'none' : '0 0 12px rgba(16,185,129,0.15)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: dryRun ? 'not-allowed' : (sending ? 'wait' : 'pointer'),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: sending ? 0.7 : 1,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {sending ? '⟳ Sending...' : '✓ Send Now'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReject}
          style={{
            background: 'rgba(239,68,68,0.15)',
            color: 'var(--red)',
            border: '1.5px solid rgba(239,68,68,0.5)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          ✕ Discard
        </motion.button>
      </div>

      {sendError && !dryRun && (
        <div style={{
          marginTop: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--red)',
          textAlign: 'center',
        }}>
          ✕ {sendError}
        </div>
      )}
    </div>
  );
}

export function LeadCard({ lead, index, dryRun, onApprove, onRewrite, onSkip }: LeadCardProps) {
  const [reviewOpen,    setReviewOpen]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState<string | null>(null);
  const [draftText,     setDraftText]     = useState(lead.editableDraftBody || lead.draftBody || '');

  useEffect(() => {
    setDraftText(lead.editableDraftBody || lead.draftBody || '');
  }, [lead.id, lead.draftBody, lead.editableDraftBody]);

  const isSent      = lead.status === 'sent';
  const isPending   = lead.status === 'pending' || lead.status === 'rewriting';
  const isDrafted   = lead.status === 'drafted';
  const isDone      = TERMINAL_STATUSES.includes(lead.status);

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
    setReviewOpen(false);
  };

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
        height: 'auto',
        background: 'var(--card)',
        border: cardBorder,
        borderRadius: 'var(--radius)',
        padding: 24,
        paddingBottom: 30,
        minHeight: 220,
        position: 'relative',
        overflow: 'hidden',
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
          top: -10,
          left: 10,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: '#FFA500',
          background: 'rgba(255, 165, 0, 0.2)',
          border: '1px solid rgba(255, 165, 0, 0.5)',
          padding: '4px 8px',
          borderRadius: 4,
          opacity: 0.95,
          zIndex: 20,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          DRY RUN
        </div>
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

      {isDrafted && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            setReviewOpen((prev) => !prev);
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            padding: '8px 16px',
            background: 'rgba(0, 209, 255, 0.1)',
            color: '#00d1ff',
            border: '1px solid rgba(0, 209, 255, 0.5)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 10,
          }}
        >
          Review Draft
        </motion.button>
      )}

      <AnimatePresence>
        {reviewOpen && (
          <ReviewPanel
            draftBody={draftText}
            onBodyChange={setDraftText}
            onSend={handleApproveSend}
            onReject={handleReject}
            onClose={() => setReviewOpen(false)}
            sending={sending}
            dryRun={dryRun}
            isOverlay={true}
            sendError={sendError}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}