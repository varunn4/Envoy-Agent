export function BottomBar() {
  const legend = [
    { label: 'Profiling',         color: 'var(--blue)' },
    { label: 'Awaiting Approval', color: 'var(--amber)' },
    { label: 'Sent',              color: 'var(--green)' },
    { label: 'Low Fit',           color: 'var(--red)' },
  ];

  return (
    <footer style={{
      height: 36,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      gap: 20,
      flexShrink: 0,
    }}>
      {legend.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--t3)',
          }}>
            {label}
          </span>
        </div>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
          Envoy v0.1
        </span>
        <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--green)',
        }}>
          Live
        </span>
      </div>
    </footer>
  );
}
