interface EmptyStateProps {
  title?: string;
  subtitle?: string;
}

export function EmptyState({ title = 'No run active.', subtitle = 'Configure region and hit Start Run.' }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 12,
      paddingTop: 60,
    }}>
      <div style={{ fontSize: 40, color: 'var(--t3)', opacity: 0.3 }}>◇</div>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--t3)' }}>{title}</p>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t3)', opacity: 0.7 }}>{subtitle}</p>
    </div>
  );
}
