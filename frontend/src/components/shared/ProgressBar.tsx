import { motion } from 'framer-motion';
import type { LeadStatus } from '../../types/lead';

interface ProgressBarProps {
  progress: number;
  status: LeadStatus;
}

function getBarColor(status: LeadStatus): string {
  if (status === 'sent')                                  return 'var(--green)';
  if (status === 'skipped' || status === 'low-fit')       return '#334155';
  if (status === 'send_failed')                           return 'var(--red)';
  return 'linear-gradient(90deg, var(--blue), var(--sky))';
}

export function ProgressBar({ progress, status }: ProgressBarProps) {
  const color = getBarColor(status);
  const isGradient = color.startsWith('linear');

  return (
    <div className="progress-track">
      <motion.div
        style={{
          height: '100%',
          borderRadius: 2,
          background: color,
          backgroundImage: isGradient ? color : undefined,
        }}
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      />
    </div>
  );
}
