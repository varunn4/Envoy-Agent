import type { LeadStatus } from '../../types/lead';
import { STATUS_COLORS, STATUS_LABELS, SPINNING_STATUSES } from '../../lib/constants';

interface BadgeProps {
  status: LeadStatus;
}

export function StatusBadge({ status }: BadgeProps) {
  // Add a fallback to STATUS_COLORS['pending'] if the current status isn't found
  const colors = STATUS_COLORS[status] || STATUS_COLORS['pending'] || { 
    bg: 'rgba(156, 163, 175, 0.1)', 
    color: '#9CA3AF', 
    border: 'rgba(156, 163, 175, 0.2)' 
  };
  
  // Add a fallback for the label as well
  const label = STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
  const isSpinning = SPINNING_STATUSES.includes(status);

  return (
    <span
      className="badge"
      style={{ background: colors.bg, color: colors.color, borderColor: colors.border }}
    >
      {isSpinning && <i className="spin" aria-hidden>◐</i>}
      {label}
    </span>
  );
}

interface FitBadgeProps {
  score: number;
}

export function FitBadge({ score }: FitBadgeProps) {
  let bg = 'var(--blue-dim)';
  let color = '#93C5FD';
  let border = 'rgba(37,99,235,0.2)';

  if (score >= 8) {
    bg = 'var(--green-dim)';
    color = 'var(--green)';
    border = 'rgba(16,185,129,0.2)';
  } else if (score <= 4) {
    bg = 'var(--red-dim)';
    color = 'var(--red)';
    border = 'rgba(239,68,68,0.2)';
  }

  return (
    <span
      className="badge"
      style={{ background: bg, color, borderColor: border }}
    >
      Fit {score}/10
    </span>
  );
}