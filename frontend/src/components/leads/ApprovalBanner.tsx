import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Lead } from '../../types/lead';
import { BUTTON_LABELS } from '../../lib/constants';

interface ApprovalBannerProps {
  lead:      Lead;
  onApprove: (id: string) => void;
  onRewrite: (id: string, note: string) => void;
  onSkip:    (id: string) => void;
}

export function ApprovalBanner({ lead, onApprove, onRewrite, onSkip }: ApprovalBannerProps) {
  const [showFull,    setShowFull]    = useState(false);
  const [rewriteNote, setRewriteNote] = useState('');
  const [showNoteBox, setShowNoteBox] = useState(false);
  const isRewriting = lead.status === 'rewriting';

  const bodyLines  = (lead.draftBody ?? '').split('\n');
  const isLong     = bodyLines.length > 6;
  const visibleBody = showFull ? lead.draftBody : bodyLines.slice(0, 6).join('\n');

  const handleApprove = () => {
    onApprove(lead.id);
  };

  const handleRewriteClick = () => {
    if (showNoteBox && rewriteNote.trim()) {
      // Submit rewrite with note
      onRewrite(lead.id, rewriteNote.trim());
      setRewriteNote('');
      setShowNoteBox(false);
    } else {
      setShowNoteBox(s => !s);
    }
  };

  const handleRewriteSubmit = () => {
    onRewrite(lead.id, rewriteNote.trim());
    setRewriteNote('');
    setShowNoteBox(false);
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        background: 'rgba(245,158,11,0.05)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 'var(--radius-sm)',
        padding: 16,
        marginTop: 12,
      }}>
        {/* Header */}
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--amber)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: 10,
        }}>
          {isRewriting ? '↺ Rewriting draft…' : '▲ Draft Ready — Awaiting Your Approval'}
        </p>

        {!isRewriting && (
          <>
            {/* Subject */}
            <div style={{ marginBottom: 10 }}>
              <span className="field-label">Subject</span>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--t1)',
              }}>
                {lead.draftSubject}
              </p>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 10 }}>
              <span className="field-label">Body</span>
              <div style={{ borderLeft: '2px solid rgba(245,158,11,0.3)', paddingLeft: 10 }}>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 12,
                  color: 'var(--t2)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                }}>
                  {visibleBody}
                </p>
                {isLong && (
                  <button
                    onClick={() => setShowFull(s => !s)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11, color: 'var(--blue)', padding: '4px 0',
                    }}
                  >
                    {showFull ? BUTTON_LABELS.showLess : BUTTON_LABELS.showMore}
                  </button>
                )}
              </div>
            </div>

            {/* Rewrite note box */}
            <AnimatePresence>
              {showNoteBox && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden', marginBottom: 10 }}
                >
                  <div style={{
                    background: 'rgba(37,99,235,0.06)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                  }}>
                    <span className="field-label" style={{ marginBottom: 6, display: 'block' }}>
                      Rewrite instructions (optional)
                    </span>
                    <textarea
                      autoFocus
                      value={rewriteNote}
                      onChange={e => setRewriteNote(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRewriteSubmit();
                      }}
                      placeholder="e.g. Make it shorter, focus on the funding angle, add urgency..."
                      rows={2}
                      style={{
                        width: '100%',
                        background: 'var(--card)',
                        border: '1px solid var(--border-2)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 12,
                        color: 'var(--t1)',
                        resize: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        onClick={handleRewriteSubmit}
                        style={{
                          background: 'var(--blue-dim)',
                          color: '#93C5FD',
                          border: '1px solid rgba(37,99,235,0.25)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11, fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        ↺ Send rewrite
                      </button>
                      <button
                        onClick={() => { setShowNoteBox(false); setRewriteNote(''); }}
                        style={{
                          background: 'none',
                          color: 'var(--t3)',
                          border: '1px solid var(--border)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: showNoteBox ? 0 : 14, flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleApprove}
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  color: 'var(--green)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, fontWeight: 600,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                ✓ {BUTTON_LABELS.approve}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleRewriteClick}
                disabled={isRewriting}
                style={{
                  background: showNoteBox ? 'rgba(37,99,235,0.18)' : 'var(--blue-dim)',
                  color: '#93C5FD',
                  border: `1px solid ${showNoteBox ? 'rgba(37,99,235,0.4)' : 'rgba(37,99,235,0.25)'}`,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isRewriting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: isRewriting ? 0.6 : 1,
                }}
              >
                ↺ {BUTTON_LABELS.rewrite}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => onSkip(lead.id)}
                style={{
                  background: 'rgba(71,85,105,0.1)',
                  color: 'var(--t3)',
                  border: '1px solid var(--border)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11, fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {BUTTON_LABELS.skip}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
