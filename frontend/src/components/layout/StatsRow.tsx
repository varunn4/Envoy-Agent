import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';
import type { RunStats } from '../../types/run';

interface StatsRowProps {
  stats: RunStats;
}

interface StatCellProps {
  label: string;
  value: number;
  accentColor: string;
  delta: number;
}

function StatCell({ label, value, accentColor, delta }: StatCellProps) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 100, damping: 20 });
  const displayRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    animate(motionVal, value, { duration: 0.4, ease: 'easeOut' });
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = Math.round(v).toString();
      }
    });
    return unsubscribe;
  }, [springVal]);

  const didIncrement = value > prevRef.current;
  useEffect(() => { prevRef.current = value; }, [value]);

  return (
    <motion.div
      animate={didIncrement ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.2 }}
      style={{
        flex: 1,
        padding: '20px 24px',
        borderRight: '1px solid var(--border)',
        borderBottom: `3px solid ${accentColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        ref={displayRef}
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 32,
          color: accentColor,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: 'var(--t3)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {label}
      </span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: delta > 0 ? 1 : 0 }}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--green)',
        }}
      >
        +{delta} this run
      </motion.span>
    </motion.div>
  );
}

export function StatsRow({ stats }: StatsRowProps) {
  const cells: StatCellProps[] = [
    { label: 'Total Pulled',      value: stats.total,    accentColor: '#475569',       delta: stats.total },
    { label: 'Profiled',          value: stats.profiled, accentColor: 'var(--sky)',    delta: stats.profiled },
    { label: 'Drafted',           value: stats.drafted,  accentColor: 'var(--blue)',   delta: stats.drafted },
    { label: 'Awaiting Approval', value: stats.pending,  accentColor: 'var(--amber)',  delta: stats.pending },
    { label: 'Sent',              value: stats.sent,     accentColor: 'var(--green)',  delta: stats.sent },
    { label: 'Skipped / Low Fit', value: stats.skipped,  accentColor: 'var(--t3)',    delta: stats.skipped },
  ];

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {cells.map((cell, i) => (
        <StatCell
          key={i}
          label={cell.label}
          value={cell.value}
          accentColor={cell.accentColor}
          delta={cell.delta}
        />
      ))}
    </div>
  );
}
