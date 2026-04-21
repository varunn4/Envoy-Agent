import { useState, useEffect, useCallback, Fragment } from 'react';
import type { RunSummary } from '../types/run';
import type { Lead }       from '../types/lead';
import { StatusBadge }     from '../components/shared/Badge';
import { EmptyState }      from '../components/shared/EmptyState';
import { fetchRuns, fetchRunLeads } from '../lib/api';

const PAGE_SIZE = 10;

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Running';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusChip({ status }: { status: string }) {
  const isComplete = status === 'complete';
  const isRunning  = status === 'running';
  const bg     = isComplete ? 'var(--green-dim)' : isRunning ? 'var(--blue-dim)' : 'var(--amber-dim)';
  const color  = isComplete ? 'var(--green)'     : isRunning ? '#93C5FD'         : 'var(--amber)';
  const border = isComplete ? 'rgba(16,185,129,0.25)' : isRunning ? 'rgba(37,99,235,0.25)' : 'rgba(245,158,11,0.25)';
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
      padding: '3px 8px', borderRadius: 100, border: `1px solid ${border}`,
      background: bg, color,
    }}>
      {status}
    </span>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const statusColor =
    lead.status === 'sent'    ? 'var(--green)' :
    lead.status === 'skipped' || lead.status === 'low-fit' ? 'var(--t3)' :
    lead.status === 'send_failed' ? 'var(--red)' : 'var(--t2)';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 130px 90px 1fr',
      gap: 12, padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'DM Sans, sans-serif', fontSize: 12,
      alignItems: 'center',
    }}>
      <span style={{ color: 'var(--t1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lead.name}
      </span>
      <span style={{ color: 'var(--sky)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lead.company}
      </span>
      <StatusBadge status={lead.status} />
      {lead.draftSubject && (
        <span style={{
          color: statusColor, fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lead.draftSubject}
        </span>
      )}
    </div>
  );
}

export function History() {
  const [runs,     setRuns]     = useState<RunSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [page,     setPage]     = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runLeads, setRunLeads] = useState<Record<string, Lead[]>>({});
  const [loadingLeads, setLoadingLeads] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchRuns()
      .then(data => { setRuns(data); setError(null); })
      .catch(err  => setError(err?.message || 'Failed to load runs'))
      .finally(()  => setLoading(false));
  }, []);

  const handleExpand = useCallback(async (runId: string) => {
    if (expanded === runId) { setExpanded(null); return; }
    setExpanded(runId);
    if (!runLeads[runId]) {
      setLoadingLeads(runId);
      try {
        const leads = await fetchRunLeads(runId);
        setRunLeads(prev => ({ ...prev, [runId]: leads }));
      } catch { /* ignore */ }
      finally { setLoadingLeads(null); }
    }
  }, [expanded, runLeads]);

  const totalPages = Math.ceil(runs.length / PAGE_SIZE);
  const pageRuns   = runs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const cols = ['Date', 'Region', 'Industry', 'Total', 'Sent', 'Skipped', 'Duration', 'Status'];

  return (
    <div style={{ padding: 32, overflowY: 'auto', height: '100%' }}>
      <h1 style={{
        fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28,
        color: 'var(--t1)', marginBottom: 6,
      }}>
        Past Runs
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--t3)', marginBottom: 24 }}>
        All execution history — fetched from database
      </p>

      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 120, fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12, color: 'var(--t3)',
        }}>
          Loading runs…
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius)', padding: '16px 20px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--red)',
        }}>
          ✕ {error} — is the backend running?
        </div>
      )}

      {!loading && !error && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          {runs.length === 0 ? (
            <EmptyState title="No runs recorded yet." subtitle="Start a run from the Dashboard." />
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {cols.map(col => (
                      <th key={col} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                        color: 'var(--t3)', textTransform: 'uppercase',
                        letterSpacing: '0.6px', fontWeight: 500,
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRuns.map(run => (
                    <Fragment key={run.id}>
                      <tr
                        onClick={() => handleExpand(run.id)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', transition: 'background 0.15s',
                          background: expanded === run.id ? 'var(--card-hover)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (expanded !== run.id) e.currentTarget.style.background = 'var(--card)'; }}
                        onMouseLeave={e => { if (expanded !== run.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t2)' }}>
                          {formatDate(run.startedAt)}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t1)' }}>
                          {run.config.region || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t2)' }}>
                          {run.config.industry || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t1)' }}>
                          {run.stats?.total ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--green)' }}>
                          {run.stats?.sent ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t3)' }}>
                          {run.stats?.skipped ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t2)' }}>
                          {formatDuration(run.startedAt, run.endedAt)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusChip status={run.status} />
                        </td>
                      </tr>

                      {expanded === run.id && (
                        <tr key={`${run.id}-exp`}>
                          <td colSpan={8} style={{
                            padding: '0 16px 12px 32px',
                            background: 'var(--card)',
                          }}>
                            {loadingLeads === run.id ? (
                              <p style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11, color: 'var(--t3)', padding: '12px 0',
                              }}>
                                Loading leads…
                              </p>
                            ) : (runLeads[run.id] || []).length === 0 ? (
                              <p style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11, color: 'var(--t3)', padding: '12px 0',
                              }}>
                                No leads for this run.
                              </p>
                            ) : (
                              <div style={{ paddingTop: 8 }}>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '160px 130px 90px 1fr',
                                  gap: 12, paddingBottom: 6,
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontSize: 9, color: 'var(--t3)',
                                  textTransform: 'uppercase', letterSpacing: '0.6px',
                                }}>
                                  <span>Name</span>
                                  <span>Company</span>
                                  <span>Status</span>
                                  <span>Subject</span>
                                </div>
                                {(runLeads[run.id] || []).map(lead => (
                                  <LeadRow key={lead.id} lead={lead} />
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  gap: 12, padding: '14px 16px',
                  borderTop: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 11 }}
                  >
                    Prev
                  </button>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--t3)' }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: 11 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
