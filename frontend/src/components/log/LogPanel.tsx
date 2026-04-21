import { useEffect, useRef, useState } from 'react';
import type { LogEntry as LogEntryType } from '../../types/log';
import { LogEntry } from './LogEntry';

type FilterType = 'all' | 'info' | 'success' | 'approvals';

interface LogPanelProps {
  logs: LogEntryType[];
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'info', label: 'Info' },
  { key: 'success', label: 'Success' },
  { key: 'approvals', label: 'Approvals' },
];

function isHidden(entry: LogEntryType, filter: FilterType): boolean {
  if (filter === 'all')       return false;
  if (filter === 'approvals') return entry.level !== 'warn';
  return entry.level !== filter;
}

export function LogPanel({ logs }: LogPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (!isAtBottom.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
          ● LIVE LOG
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 5,
                border: filter === key
                  ? '1px solid rgba(37,99,235,0.3)'
                  : '1px solid var(--border)',
                background: filter === key ? 'var(--blue-dim)' : 'transparent',
                color: filter === key ? '#93C5FD' : 'var(--t3)',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 0',
        }}
      >
        {logs.length === 0 && (
          <div style={{
            padding: '20px 18px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--t3)',
            opacity: 0.5,
          }}>
            Waiting for run to start...
          </div>
        )}
        {logs.map(entry => (
          <LogEntry
            key={entry.id}
            entry={entry}
            hidden={isHidden(entry, filter)}
          />
        ))}
      </div>
    </div>
  );
}
