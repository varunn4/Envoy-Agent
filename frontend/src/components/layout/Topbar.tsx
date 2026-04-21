import { NavLink, useNavigate } from 'react-router-dom';
import { useClock } from '../../hooks/useClock';

interface TopbarProps {
  running: boolean;
  pendingCount: number;
}

type LedState = 'idle' | 'running' | 'waiting' | 'stopped';

export function Topbar({ running, pendingCount }: TopbarProps) {
  const clock = useClock();
  const navigate = useNavigate();

  let ledState: LedState = 'idle';
  let statusText = 'Idle';
  if (running && pendingCount > 0) {
    ledState = 'waiting';
    statusText = `${pendingCount} awaiting approval`;
  } else if (running) {
    ledState = 'running';
    statusText = 'Running';
  }

  return (
    <header style={{
      height: 52,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Left: Logo + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
        {/* Logo mark */}
        <div style={{
          width: 28,
          height: 28,
          background: 'var(--blue)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <text x="2" y="13" fontFamily="Syne" fontWeight="700" fontSize="13" fill="white">E</text>
          </svg>
        </div>

        {/* Brand name */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--t1)' }}>
            Envoy
          </span>
          <span style={{ color: 'var(--t3)', fontSize: 13 }}>/</span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 400, fontSize: 13, color: 'var(--t3)' }}>
            Sales Agent
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />

        {/* Status LED */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={`led led-${ledState}`} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Center: Nav tabs */}
      <nav style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 0,
      }}>
        {[
          { to: '/', label: 'Dashboard' },
          { to: '/history', label: 'History' },
          { to: '/settings', label: 'Settings' },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: isActive ? 'var(--t1)' : 'var(--t3)',
              textDecoration: 'none',
              padding: '0 16px',
              height: 52,
              display: 'flex',
              alignItems: 'center',
              borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent',
              transition: 'color 0.15s',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              if (el.style.color !== 'var(--t1)') el.style.color = 'var(--t2)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              if (el.style.borderBottom !== '2px solid var(--blue)') el.style.color = 'var(--t3)';
            }}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right: Clock + settings */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t3)' }}>
          {clock}
        </span>
        <button
          onClick={() => navigate('/settings')}
          aria-label="Open settings"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--t3)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
