import { motion } from 'framer-motion';
import type { LogEntry as LogEntryType } from '../../types/log';
import { LOG_ICONS } from '../../lib/constants';

const LEVEL_COLORS: Record<LogEntryType['level'], string> = {
  info:    'var(--blue)',
  success: 'var(--green)',
  warn:    'var(--amber)',
  error:   'var(--red)',
  system:  'var(--t3)',
};

const MESSAGE_COLORS: Record<LogEntryType['level'], string> = {
  info:    'var(--t1)',
  success: 'var(--green)',
  warn:    'var(--amber)',
  error:   'var(--red)',
  system:  'var(--t3)',
};

function highlightText(message: string, highlight: string | null): React.ReactNode {
  if (!highlight) return message;
  const idx = message.indexOf(highlight);
  if (idx === -1) return message;
  return (
    <>
      {message.slice(0, idx)}
      <mark style={{
        background: 'rgba(37,99,235,0.15)',
        color: 'var(--sky)',
        padding: '1px 5px',
        borderRadius: 4,
        fontWeight: 500,
        fontStyle: 'normal',
      }}>
        {highlight}
      </mark>
      {message.slice(idx + highlight.length)}
    </>
  );
}

interface LogEntryProps {
  entry: LogEntryType;
  hidden: boolean;
}

export function LogEntry({ entry, hidden }: LogEntryProps) {
  const icon = LOG_ICONS[entry.level];
  const iconColor = LEVEL_COLORS[entry.level];
  const msgColor = MESSAGE_COLORS[entry.level];

  return (
    <motion.div
      initial={{ x: 10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: hidden ? 'none' : 'flex',
        gap: 10,
        padding: '5px 18px',
        alignItems: 'baseline',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10.5,
        color: 'var(--t3)',
        flexShrink: 0,
        minWidth: 60,
      }}>
        {entry.ts}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, color: iconColor }}>{icon}</span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11.5,
        color: msgColor,
        flex: 1,
        lineHeight: 1.5,
      }}>
        {highlightText(entry.message, entry.highlight)}
      </span>
    </motion.div>
  );
}
